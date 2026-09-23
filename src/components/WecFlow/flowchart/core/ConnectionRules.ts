import type { Connection, FlowEdge, FlowNode } from '../models/FlowTypes';
import type { NodeTypeRegistry } from '../models/NodeTypes';
import { findHandle } from '../utils/geometry';

export interface ConnectionCheckResult {
  valid: boolean;
  reason?: string;
}

export interface ConnectionContext {
  nodeLookup: ReadonlyMap<string, FlowNode>;
  edges: readonly FlowEdge[];
  registry: NodeTypeRegistry;
  /** Edge to ignore when counting limits / duplicates (used when re-checking an existing edge). */
  ignoreEdgeId?: string;
}

export type ConnectionValidator = (connection: Connection, context: ConnectionContext) => ConnectionCheckResult;

const invalid = (reason: string): ConnectionCheckResult => ({ valid: false, reason });

/** Built-in structural rules every connection must satisfy. */
export function checkConnection(conn: Connection, ctx: ConnectionContext): ConnectionCheckResult {
  const source = ctx.nodeLookup.get(conn.source);
  const target = ctx.nodeLookup.get(conn.target);
  if (!source) return invalid(`Source node "${conn.source}" does not exist`);
  if (!target) return invalid(`Target node "${conn.target}" does not exist`);
  if (source.id === target.id) return invalid('A node cannot connect to itself');

  const sourceDef = ctx.registry.get(source.type);
  const targetDef = ctx.registry.get(target.type);
  const sourceHandle = findHandle(sourceDef, 'source', conn.sourceHandle);
  const targetHandle = findHandle(targetDef, 'target', conn.targetHandle);
  if (!sourceHandle) return invalid(`"${source.data.label}" has no output${conn.sourceHandle ? ` "${conn.sourceHandle}"` : ''}`);
  if (!targetHandle) return invalid(`"${target.data.label}" has no input${conn.targetHandle ? ` "${conn.targetHandle}"` : ''}`);

  const others = ctx.ignoreEdgeId ? ctx.edges.filter((e) => e.id !== ctx.ignoreEdgeId) : ctx.edges;
  const srcHandleId = sourceHandle.id;
  const tgtHandleId = targetHandle.id;

  const outgoing = others.filter((e) => e.source === source.id);
  const incoming = others.filter((e) => e.target === target.id);

  if (outgoing.some((e) => e.target === target.id && (e.sourceHandle ?? srcHandleId) === srcHandleId && (e.targetHandle ?? tgtHandleId) === tgtHandleId)) {
    return invalid('These handles are already connected');
  }
  if (sourceDef.maxOutgoing !== undefined && outgoing.length >= sourceDef.maxOutgoing) {
    return invalid(sourceDef.maxOutgoing === 0 ? `${sourceDef.label} nodes cannot have outgoing connections` : `${sourceDef.label} allows at most ${sourceDef.maxOutgoing} outgoing connections`);
  }
  if (targetDef.maxIncoming !== undefined && incoming.length >= targetDef.maxIncoming) {
    return invalid(targetDef.maxIncoming === 0 ? `${targetDef.label} nodes cannot have incoming connections` : `${targetDef.label} allows at most ${targetDef.maxIncoming} incoming connections`);
  }
  if (sourceHandle.maxConnections !== undefined) {
    const used = outgoing.filter((e) => (e.sourceHandle ?? findHandle(sourceDef, 'source')?.id) === srcHandleId).length;
    if (used >= sourceHandle.maxConnections) return invalid(`Output "${sourceHandle.label ?? srcHandleId}" is already connected`);
  }
  if (targetHandle.maxConnections !== undefined) {
    const used = incoming.filter((e) => (e.targetHandle ?? findHandle(targetDef, 'target')?.id) === tgtHandleId).length;
    if (used >= targetHandle.maxConnections) return invalid(`Input "${targetHandle.label ?? tgtHandleId}" is already connected`);
  }
  return { valid: true };
}

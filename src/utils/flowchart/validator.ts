import type { FlowEdge, FlowNode, FlowSnapshot } from "../../types/flowchart.types";
import type { NodeTypeRegistry } from "./nodeTypes";
import { checkConnection } from "./connectionRules";

export type IssueSeverity = "error" | "warning";

export interface ValidationIssue {
  id: string;
  code: string;
  severity: IssueSeverity;
  message: string;
  nodeIds?: string[];
  edgeIds?: string[];
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
}

export interface ValidationContext {
  nodes: readonly FlowNode[];
  edges: readonly FlowEdge[];
  registry: NodeTypeRegistry;
  nodeLookup: ReadonlyMap<string, FlowNode>;
  incoming: ReadonlyMap<string, FlowEdge[]>;
  outgoing: ReadonlyMap<string, FlowEdge[]>;
}

/** A rule inspects the flow and returns zero or more issues (ids are assigned by the validator). */
export type ValidationRule = (ctx: ValidationContext) => Omit<ValidationIssue, "id">[];

const roleOf = (ctx: ValidationContext, node: FlowNode) =>
  ctx.registry.get(node.type).role ?? "default";
const name = (n: FlowNode) => `"${n.data.label || n.id}"`;

export const startNodeRequired: ValidationRule = (ctx) => {
  const starts = ctx.nodes.filter((n) => roleOf(ctx, n) === "start");
  if (starts.length === 0)
    return [{ code: "start-required", severity: "error", message: "The flow needs a Start node" }];
  if (starts.length > 1) {
    return [
      {
        code: "multiple-starts",
        severity: "warning",
        message: `The flow has ${starts.length} Start nodes`,
        nodeIds: starts.map((n) => n.id),
      },
    ];
  }
  return [];
};

export const endNodeRequired: ValidationRule = (ctx) =>
  ctx.nodes.some((n) => roleOf(ctx, n) === "end")
    ? []
    : [{ code: "end-required", severity: "error", message: "The flow needs an End node" }];

export const disconnectedNodes: ValidationRule = (ctx) =>
  ctx.nodes
    .filter((n) => !ctx.incoming.get(n.id)?.length && !ctx.outgoing.get(n.id)?.length)
    .map((n) => ({
      code: "disconnected",
      severity: "error" as const,
      message: `${name(n)} is not connected to anything`,
      nodeIds: [n.id],
    }));

/** Nodes that are connected but can't be reached from any start node. */
export const unreachableNodes: ValidationRule = (ctx) => {
  const starts = ctx.nodes.filter((n) => roleOf(ctx, n) === "start");
  if (starts.length === 0) return [];
  const seen = new Set<string>(starts.map((n) => n.id));
  const queue = [...seen];
  while (queue.length) {
    const id = queue.shift()!;
    for (const e of ctx.outgoing.get(id) ?? []) {
      if (!seen.has(e.target) && ctx.nodeLookup.has(e.target)) {
        seen.add(e.target);
        queue.push(e.target);
      }
    }
  }
  return ctx.nodes
    .filter(
      (n) => !seen.has(n.id) && (ctx.incoming.get(n.id)?.length || ctx.outgoing.get(n.id)?.length),
    )
    .map((n) => ({
      code: "unreachable",
      severity: "warning" as const,
      message: `${name(n)} cannot be reached from Start`,
      nodeIds: [n.id],
    }));
};

/** Nodes (other than End nodes) whose flow stops because they have no outgoing edge. */
export const deadEnds: ValidationRule = (ctx) =>
  ctx.nodes
    .filter((n) => roleOf(ctx, n) !== "end" && ctx.registry.get(n.type).maxOutgoing !== 0)
    .filter((n) => ctx.incoming.get(n.id)?.length && !ctx.outgoing.get(n.id)?.length)
    .map((n) => ({
      code: "dead-end",
      severity: "warning" as const,
      message: `${name(n)} has no outgoing connection`,
      nodeIds: [n.id],
    }));

export const invalidConnections: ValidationRule = (ctx) => {
  const issues: Omit<ValidationIssue, "id">[] = [];
  for (const edge of ctx.edges) {
    const result = checkConnection(edge, {
      nodeLookup: ctx.nodeLookup,
      edges: ctx.edges,
      registry: ctx.registry,
      ignoreEdgeId: edge.id,
    });
    if (!result.valid) {
      issues.push({
        code: "invalid-connection",
        severity: "error",
        message: `Invalid connection: ${result.reason}`,
        edgeIds: [edge.id],
        nodeIds: [edge.source, edge.target].filter((id) => ctx.nodeLookup.has(id)),
      });
    }
  }
  return issues;
};

export const decisionBranches: ValidationRule = (ctx) =>
  ctx.nodes
    .filter((n) => ctx.registry.get(n.type).shape === "diamond")
    .filter((n) => (ctx.outgoing.get(n.id)?.length ?? 0) < 2)
    .map((n) => ({
      code: "decision-branches",
      severity: "warning" as const,
      message: `Decision ${name(n)} should have at least two outgoing branches`,
      nodeIds: [n.id],
    }));

export const unknownNodeTypes: ValidationRule = (ctx) =>
  ctx.nodes
    .filter((n) => !ctx.registry.has(n.type))
    .map((n) => ({
      code: "unknown-type",
      severity: "warning" as const,
      message: `${name(n)} uses unknown node type "${n.type}"`,
      nodeIds: [n.id],
    }));

export const defaultValidationRules: ValidationRule[] = [
  startNodeRequired,
  endNodeRequired,
  invalidConnections,
  disconnectedNodes,
  unreachableNodes,
  deadEnds,
  decisionBranches,
  unknownNodeTypes,
];

function buildContext(flow: FlowSnapshot, registry: NodeTypeRegistry): ValidationContext {
  const nodeLookup = new Map(flow.nodes.map((n) => [n.id, n]));
  const incoming = new Map<string, FlowEdge[]>();
  const outgoing = new Map<string, FlowEdge[]>();
  for (const e of flow.edges) {
    if (!outgoing.has(e.source)) outgoing.set(e.source, []);
    if (!incoming.has(e.target)) incoming.set(e.target, []);
    outgoing.get(e.source)!.push(e);
    incoming.get(e.target)!.push(e);
  }
  return { nodes: flow.nodes, edges: flow.edges, registry, nodeLookup, incoming, outgoing };
}

/** Runs the given rules over a flow. Pure function: safe to call from anywhere (server, worker, tests). */
export function validateFlow(
  flow: FlowSnapshot,
  registry: NodeTypeRegistry,
  rules: ValidationRule[] = defaultValidationRules,
): ValidationResult {
  const ctx = buildContext(flow, registry);
  const issues = rules
    .flatMap((rule) => rule(ctx))
    .map((issue, i) => ({ ...issue, id: `${issue.code}-${i}` }));
  const errorCount = issues.filter((i) => i.severity === "error").length;
  return { valid: errorCount === 0, issues, errorCount, warningCount: issues.length - errorCount };
}

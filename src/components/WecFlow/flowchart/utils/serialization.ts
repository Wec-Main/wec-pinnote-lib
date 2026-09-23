import {
  FLOW_JSON_VERSION,
  type FlowEdge,
  type FlowJSON,
  type FlowNode,
  type PropertyValue,
  type Viewport,
} from '../models/FlowTypes';
import { createId } from './id';

export class FlowParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FlowParseError';
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPropertyValue = (v: unknown): v is PropertyValue =>
  v === null || ['string', 'number', 'boolean'].includes(typeof v);

function parseNode(raw: unknown, index: number): FlowNode {
  const where = `nodes[${index}]`;
  if (!isObject(raw)) throw new FlowParseError(`${where} must be an object`);
  if (typeof raw.id !== 'string' || raw.id === '') throw new FlowParseError(`${where}.id must be a non-empty string`);
  if (typeof raw.type !== 'string' || raw.type === '') throw new FlowParseError(`${where}.type must be a non-empty string`);
  const pos = raw.position;
  if (!isObject(pos) || !isFiniteNumber(pos.x) || !isFiniteNumber(pos.y)) {
    throw new FlowParseError(`${where}.position must be { x: number, y: number }`);
  }
  const data = isObject(raw.data) ? raw.data : {};
  const properties: Record<string, PropertyValue> = {};
  if (isObject(data.properties)) {
    for (const [k, v] of Object.entries(data.properties)) {
      if (isPropertyValue(v)) properties[k] = v;
    }
  }
  const node: FlowNode = {
    id: raw.id,
    type: raw.type,
    position: { x: pos.x, y: pos.y },
    data: {
      label: typeof data.label === 'string' ? data.label : raw.type,
      description: typeof data.description === 'string' ? data.description : '',
      properties,
      ...(isObject(data.meta) ? { meta: data.meta } : {}),
    },
  };
  if (isFiniteNumber(raw.width) && raw.width > 0) node.width = raw.width;
  if (isFiniteNumber(raw.height) && raw.height > 0) node.height = raw.height;
  if (typeof raw.parentId === 'string') node.parentId = raw.parentId;
  return node;
}

function parseEdge(raw: unknown, index: number): FlowEdge {
  const where = `edges[${index}]`;
  if (!isObject(raw)) throw new FlowParseError(`${where} must be an object`);
  if (typeof raw.source !== 'string' || typeof raw.target !== 'string') {
    throw new FlowParseError(`${where} must have string "source" and "target"`);
  }
  const edge: FlowEdge = {
    id: typeof raw.id === 'string' && raw.id !== '' ? raw.id : createId('edge'),
    source: raw.source,
    target: raw.target,
  };
  if (typeof raw.sourceHandle === 'string') edge.sourceHandle = raw.sourceHandle;
  if (typeof raw.targetHandle === 'string') edge.targetHandle = raw.targetHandle;
  if (typeof raw.label === 'string') edge.label = raw.label;
  if (raw.type === 'bezier' || raw.type === 'straight' || raw.type === 'step') edge.type = raw.type;
  if (isFiniteNumber(raw.bend)) edge.bend = raw.bend;
  if (typeof raw.animated === 'boolean') edge.animated = raw.animated;
  if (isObject(raw.data)) edge.data = raw.data;
  return edge;
}

/**
 * Parses and structurally validates flow JSON (string or object). Throws a
 * FlowParseError with a readable message when the input is malformed.
 * Semantic problems (e.g. edges pointing at missing nodes) are left to the
 * Validator so that imperfect flows can still be opened and fixed.
 */
export function parseFlow(input: string | unknown): FlowJSON {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch (e) {
      throw new FlowParseError(`Invalid JSON: ${(e as Error).message}`);
    }
  }
  if (!isObject(raw)) throw new FlowParseError('Flow must be a JSON object with "nodes" and "edges"');
  if (!Array.isArray(raw.nodes)) throw new FlowParseError('"nodes" must be an array');
  if (raw.edges !== undefined && !Array.isArray(raw.edges)) throw new FlowParseError('"edges" must be an array');

  const nodes = raw.nodes.map(parseNode);
  const seen = new Set<string>();
  for (const n of nodes) {
    if (seen.has(n.id)) throw new FlowParseError(`Duplicate node id "${n.id}"`);
    seen.add(n.id);
  }
  const edges = ((raw.edges as unknown[] | undefined) ?? []).map(parseEdge);
  const flow: FlowJSON = { version: isFiniteNumber(raw.version) ? raw.version : FLOW_JSON_VERSION, nodes, edges };

  const vp = raw.viewport;
  if (isObject(vp) && isFiniteNumber(vp.x) && isFiniteNumber(vp.y) && isFiniteNumber(vp.zoom) && vp.zoom > 0) {
    flow.viewport = { x: vp.x, y: vp.y, zoom: vp.zoom } satisfies Viewport;
  }
  if (isObject(raw.meta)) flow.meta = raw.meta;
  return flow;
}

export function stringifyFlow(flow: FlowJSON, pretty = true): string {
  return JSON.stringify(flow, null, pretty ? 2 : undefined);
}

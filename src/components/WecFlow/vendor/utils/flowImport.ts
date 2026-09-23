import type {
  FlowDefinition,
  FlowEdge,
  FlowNode,
  FlowNodeType,
} from "../types/flow.types";

/**
 * Thrown by {@link importFlow} whenever the supplied text is not valid JSON,
 * or the parsed JSON does not have the minimal shape of a {@link FlowDefinition}.
 */
export class FlowImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FlowImportError";
  }
}

const FLOW_NODE_TYPES: readonly FlowNodeType[] = [
  "start",
  "end",
  "process",
  "decision",
  "input",
  "output",
];

/**
 * Parses a JSON string and validates that it has the minimal required shape
 * of a {@link FlowDefinition}.
 *
 * The input is treated as untrusted: any structural problem (wrong types,
 * missing fields, `null`, an array instead of an object, etc.) results in a
 * {@link FlowImportError} with a specific, actionable message rather than an
 * unhandled exception.
 */
export function importFlow(json: string): FlowDefinition {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new FlowImportError(`Invalid JSON: ${reason}`);
  }

  return parseFlowDefinition(parsed);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFlowDefinition(value: unknown): FlowDefinition {
  if (!isRecord(value)) {
    throw new FlowImportError(
      "Invalid flow: expected a JSON object at the top level."
    );
  }

  if (typeof value.id !== "string") {
    throw new FlowImportError('Invalid flow: missing or invalid "id".');
  }

  if (typeof value.name !== "string") {
    throw new FlowImportError('Invalid flow: missing or invalid "name".');
  }

  if (
    value.description !== undefined &&
    typeof value.description !== "string"
  ) {
    throw new FlowImportError(
      'Invalid flow: "description" must be a string when provided.'
    );
  }

  if (!Array.isArray(value.nodes)) {
    throw new FlowImportError('Invalid flow: missing or invalid "nodes" array.');
  }

  const nodes: FlowNode[] = value.nodes.map((node, index) =>
    parseFlowNode(node, index)
  );

  if (!Array.isArray(value.edges)) {
    throw new FlowImportError('Invalid flow: missing or invalid "edges" array.');
  }

  const edges: FlowEdge[] = value.edges.map((edge, index) =>
    parseFlowEdge(edge, index)
  );

  const flow: FlowDefinition = {
    id: value.id,
    name: value.name,
    nodes,
    edges,
  };

  if (typeof value.description === "string") {
    flow.description = value.description;
  }

  return flow;
}

function parseFlowNode(value: unknown, index: number): FlowNode {
  if (!isRecord(value)) {
    throw new FlowImportError(
      `Invalid flow: nodes[${index}] must be an object.`
    );
  }

  if (typeof value.id !== "string") {
    throw new FlowImportError(
      `Invalid flow: nodes[${index}] is missing a valid "id".`
    );
  }

  if (
    typeof value.type !== "string" ||
    !FLOW_NODE_TYPES.includes(value.type as FlowNodeType)
  ) {
    throw new FlowImportError(
      `Invalid flow: nodes[${index}] is missing a valid "type".`
    );
  }

  if (!isRecord(value.position)) {
    throw new FlowImportError(
      `Invalid flow: nodes[${index}] is missing a valid "position".`
    );
  }

  if (
    typeof value.position.x !== "number" ||
    typeof value.position.y !== "number"
  ) {
    throw new FlowImportError(
      `Invalid flow: nodes[${index}].position must have numeric "x" and "y".`
    );
  }

  if (!isRecord(value.data)) {
    throw new FlowImportError(
      `Invalid flow: nodes[${index}] is missing a valid "data" object.`
    );
  }

  if (typeof value.data.label !== "string") {
    throw new FlowImportError(
      `Invalid flow: nodes[${index}].data is missing a valid "label".`
    );
  }

  const node: FlowNode = {
    id: value.id,
    type: value.type as FlowNodeType,
    position: {
      x: value.position.x,
      y: value.position.y,
    },
    data: {
      ...value.data,
      label: value.data.label,
    },
  };

  return node;
}

function parseFlowEdge(value: unknown, index: number): FlowEdge {
  if (!isRecord(value)) {
    throw new FlowImportError(
      `Invalid flow: edges[${index}] must be an object.`
    );
  }

  if (typeof value.id !== "string") {
    throw new FlowImportError(
      `Invalid flow: edges[${index}] is missing a valid "id".`
    );
  }

  if (typeof value.source !== "string") {
    throw new FlowImportError(
      `Invalid flow: edges[${index}] is missing a valid "source".`
    );
  }

  if (typeof value.target !== "string") {
    throw new FlowImportError(
      `Invalid flow: edges[${index}] is missing a valid "target".`
    );
  }

  if (
    value.sourceHandle !== undefined &&
    typeof value.sourceHandle !== "string"
  ) {
    throw new FlowImportError(
      `Invalid flow: edges[${index}].sourceHandle must be a string when provided.`
    );
  }

  if (
    value.targetHandle !== undefined &&
    typeof value.targetHandle !== "string"
  ) {
    throw new FlowImportError(
      `Invalid flow: edges[${index}].targetHandle must be a string when provided.`
    );
  }

  if (value.label !== undefined && typeof value.label !== "string") {
    throw new FlowImportError(
      `Invalid flow: edges[${index}].label must be a string when provided.`
    );
  }

  const edge: FlowEdge = {
    id: value.id,
    source: value.source,
    target: value.target,
  };

  if (typeof value.sourceHandle === "string") {
    edge.sourceHandle = value.sourceHandle;
  }

  if (typeof value.targetHandle === "string") {
    edge.targetHandle = value.targetHandle;
  }

  if (typeof value.label === "string") {
    edge.label = value.label;
  }

  return edge;
}

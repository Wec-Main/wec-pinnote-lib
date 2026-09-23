import type {
  FlowDefinition,
  FlowEdge,
  FlowEdgeArrow,
  FlowEdgeArrowShape,
  FlowEdgeLineStyle,
  FlowEdgeRouting,
  FlowEdgeWaypoint,
  FlowLayer,
  FlowNode,
  FlowNodeStyle,
  FlowNodeType,
  FlowPage,
  RichText,
} from "../types/flow.types";
import { generateId } from "./id";
import { isRichText, plainTextToRichText } from "./richText";

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
  "rectangle",
  "roundedRectangle",
  "ellipse",
  "diamond",
  "parallelogram",
  "triangle",
  "hexagon",
  "cylinder",
  "cloud",
  "document",
  "text",
  "container",
  "actor",
  "package",
  "note",
];

const FLOW_EDGE_LINE_STYLES: readonly FlowEdgeLineStyle[] = ["solid", "dashed", "dotted"];
const FLOW_EDGE_ARROWS: readonly FlowEdgeArrow[] = ["none", "forward", "both"];
const FLOW_EDGE_ARROW_SHAPES: readonly FlowEdgeArrowShape[] = ["triangle", "open"];
const FLOW_EDGE_ROUTINGS: readonly FlowEdgeRouting[] = ["straight", "orthogonal", "curved"];

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

  const pages = Array.isArray(value.pages)
    ? value.pages.map((page, index) => parseFlowPage(page, index))
    : [parseLegacyPageFromTopLevel(value)];

  const flow: FlowDefinition = {
    id: value.id,
    name: value.name,
    pages,
  };

  if (typeof value.description === "string") {
    flow.description = value.description;
  }

  if (typeof value.schemaVersion === "number") {
    flow.schemaVersion = value.schemaVersion;
  }

  const requestedActivePageId =
    typeof value.activePageId === "string" ? value.activePageId : undefined;
  flow.activePageId =
    requestedActivePageId && pages.some((page) => page.id === requestedActivePageId)
      ? requestedActivePageId
      : pages[0]?.id;

  return flow;
}

function parseLegacyPageFromTopLevel(value: Record<string, unknown>): FlowPage {
  if (!Array.isArray(value.nodes)) {
    throw new FlowImportError('Invalid flow: missing or invalid "nodes" array.');
  }

  const nodes: FlowNode[] = value.nodes.map((node, index) =>
    parseFlowNode(node, index, "nodes")
  );

  if (!Array.isArray(value.edges)) {
    throw new FlowImportError('Invalid flow: missing or invalid "edges" array.');
  }

  const edges: FlowEdge[] = value.edges.map((edge, index) =>
    parseFlowEdge(edge, index, "edges")
  );

  return { id: generateId("page"), name: "Page 1", nodes, edges };
}

function parseFlowLayers(value: unknown, index: number): FlowLayer[] {
  if (!Array.isArray(value)) {
    throw new FlowImportError(`Invalid flow: pages[${index}].layers must be an array when provided.`);
  }
  return value.map((layer, layerIndex) => {
    if (!isRecord(layer)) {
      throw new FlowImportError(`Invalid flow: pages[${index}].layers[${layerIndex}] must be an object.`);
    }
    if (typeof layer.id !== "string") {
      throw new FlowImportError(
        `Invalid flow: pages[${index}].layers[${layerIndex}] is missing a valid "id".`,
      );
    }
    if (typeof layer.name !== "string") {
      throw new FlowImportError(
        `Invalid flow: pages[${index}].layers[${layerIndex}] is missing a valid "name".`,
      );
    }
    if (typeof layer.visible !== "boolean") {
      throw new FlowImportError(
        `Invalid flow: pages[${index}].layers[${layerIndex}].visible must be a boolean.`,
      );
    }
    if (typeof layer.locked !== "boolean") {
      throw new FlowImportError(
        `Invalid flow: pages[${index}].layers[${layerIndex}].locked must be a boolean.`,
      );
    }
    return { id: layer.id, name: layer.name, visible: layer.visible, locked: layer.locked };
  });
}

function parseFlowPage(value: unknown, index: number): FlowPage {
  if (!isRecord(value)) {
    throw new FlowImportError(`Invalid flow: pages[${index}] must be an object.`);
  }

  if (typeof value.id !== "string") {
    throw new FlowImportError(`Invalid flow: pages[${index}] is missing a valid "id".`);
  }

  if (typeof value.name !== "string") {
    throw new FlowImportError(`Invalid flow: pages[${index}] is missing a valid "name".`);
  }

  if (!Array.isArray(value.nodes)) {
    throw new FlowImportError(`Invalid flow: pages[${index}] is missing a valid "nodes" array.`);
  }

  const layers = value.layers !== undefined ? parseFlowLayers(value.layers, index) : undefined;

  const nodes: FlowNode[] = value.nodes.map((node, nodeIndex) =>
    parseFlowNode(node, nodeIndex, `pages[${index}].nodes`)
  );

  if (!Array.isArray(value.edges)) {
    throw new FlowImportError(`Invalid flow: pages[${index}] is missing a valid "edges" array.`);
  }

  const edges: FlowEdge[] = value.edges.map((edge, edgeIndex) =>
    parseFlowEdge(edge, edgeIndex, `pages[${index}].edges`)
  );

  const page: FlowPage = { id: value.id, name: value.name, nodes, edges };

  if (layers !== undefined) {
    page.layers = layers;
  }

  if (value.background !== undefined) {
    if (typeof value.background !== "string") {
      throw new FlowImportError(`Invalid flow: pages[${index}].background must be a string.`);
    }
    page.background = value.background;
  }

  if (value.gridSettings !== undefined) {
    if (!isRecord(value.gridSettings)) {
      throw new FlowImportError(`Invalid flow: pages[${index}].gridSettings must be an object.`);
    }
    const { enabled, size, snap } = value.gridSettings;
    page.gridSettings = {
      ...(typeof enabled === "boolean" ? { enabled } : {}),
      ...(typeof size === "number" ? { size } : {}),
      ...(typeof snap === "boolean" ? { snap } : {}),
    };
  }

  if (value.viewport !== undefined) {
    if (!isRecord(value.viewport)) {
      throw new FlowImportError(`Invalid flow: pages[${index}].viewport must be an object.`);
    }
    const { x, y, zoom } = value.viewport;
    if (typeof x !== "number" || typeof y !== "number" || typeof zoom !== "number") {
      throw new FlowImportError(
        `Invalid flow: pages[${index}].viewport must have numeric "x", "y", and "zoom".`,
      );
    }
    page.viewport = { x, y, zoom };
  }

  return page;
}

function migrateLabel(value: unknown, context: string): RichText {
  if (typeof value === "string") {
    return plainTextToRichText(value);
  }
  if (isRichText(value)) {
    return value;
  }
  throw new FlowImportError(`Invalid flow: ${context} must be a string or rich text object.`);
}

function parseFlowNode(value: unknown, index: number, context: string): FlowNode {
  if (!isRecord(value)) {
    throw new FlowImportError(
      `Invalid flow: ${context}[${index}] must be an object.`
    );
  }

  if (typeof value.id !== "string") {
    throw new FlowImportError(
      `Invalid flow: ${context}[${index}] is missing a valid "id".`
    );
  }

  if (
    typeof value.type !== "string" ||
    !FLOW_NODE_TYPES.includes(value.type as FlowNodeType)
  ) {
    throw new FlowImportError(
      `Invalid flow: ${context}[${index}] is missing a valid "type".`
    );
  }

  if (!isRecord(value.position)) {
    throw new FlowImportError(
      `Invalid flow: ${context}[${index}] is missing a valid "position".`
    );
  }

  if (
    typeof value.position.x !== "number" ||
    typeof value.position.y !== "number"
  ) {
    throw new FlowImportError(
      `Invalid flow: ${context}[${index}].position must have numeric "x" and "y".`
    );
  }

  if (!isRecord(value.data)) {
    throw new FlowImportError(
      `Invalid flow: ${context}[${index}] is missing a valid "data" object.`
    );
  }

  if (value.data.label === undefined) {
    throw new FlowImportError(
      `Invalid flow: ${context}[${index}].data is missing a valid "label".`
    );
  }

  const label = migrateLabel(value.data.label, `${context}[${index}].data.label`);

  if (value.locked !== undefined && typeof value.locked !== "boolean") {
    throw new FlowImportError(
      `Invalid flow: ${context}[${index}].locked must be a boolean when provided.`,
    );
  }

  if (value.layerId !== undefined && typeof value.layerId !== "string") {
    throw new FlowImportError(
      `Invalid flow: ${context}[${index}].layerId must be a string when provided.`,
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
      label,
    },
  };

  if (typeof value.locked === "boolean") {
    node.locked = value.locked;
  }

  if (typeof value.layerId === "string") {
    node.layerId = value.layerId;
  }

  if (value.style !== undefined) {
    node.style = parseFlowNodeStyle(value.style, index, context);
  }

  return node;
}

function parseFlowNodeStyle(value: unknown, index: number, context: string): FlowNodeStyle {
  if (!isRecord(value)) {
    throw new FlowImportError(
      `Invalid flow: ${context}[${index}].style must be an object when provided.`,
    );
  }

  const style: FlowNodeStyle = {};

  if (value.fill !== undefined) {
    if (typeof value.fill !== "string") {
      throw new FlowImportError(`Invalid flow: ${context}[${index}].style.fill must be a string.`);
    }
    style.fill = value.fill;
  }

  if (value.stroke !== undefined) {
    if (typeof value.stroke !== "string") {
      throw new FlowImportError(`Invalid flow: ${context}[${index}].style.stroke must be a string.`);
    }
    style.stroke = value.stroke;
  }

  if (value.strokeWidth !== undefined) {
    if (typeof value.strokeWidth !== "number") {
      throw new FlowImportError(
        `Invalid flow: ${context}[${index}].style.strokeWidth must be a number.`,
      );
    }
    style.strokeWidth = value.strokeWidth;
  }

  if (value.lineStyle !== undefined) {
    if (!FLOW_EDGE_LINE_STYLES.includes(value.lineStyle as FlowEdgeLineStyle)) {
      throw new FlowImportError(
        `Invalid flow: ${context}[${index}].style.lineStyle must be "solid", "dashed", or "dotted".`,
      );
    }
    style.lineStyle = value.lineStyle as FlowEdgeLineStyle;
  }

  if (value.opacity !== undefined) {
    if (typeof value.opacity !== "number") {
      throw new FlowImportError(`Invalid flow: ${context}[${index}].style.opacity must be a number.`);
    }
    style.opacity = value.opacity;
  }

  if (value.rotation !== undefined) {
    if (typeof value.rotation !== "number") {
      throw new FlowImportError(`Invalid flow: ${context}[${index}].style.rotation must be a number.`);
    }
    style.rotation = value.rotation;
  }

  if (value.perimeter !== undefined) {
    if (typeof value.perimeter !== "number") {
      throw new FlowImportError(
        `Invalid flow: ${context}[${index}].style.perimeter must be a number.`,
      );
    }
    style.perimeter = value.perimeter;
  }

  if (value.shadow !== undefined) {
    if (typeof value.shadow !== "boolean") {
      throw new FlowImportError(`Invalid flow: ${context}[${index}].style.shadow must be a boolean.`);
    }
    style.shadow = value.shadow;
  }

  if (value.glow !== undefined) {
    if (typeof value.glow !== "boolean") {
      throw new FlowImportError(`Invalid flow: ${context}[${index}].style.glow must be a boolean.`);
    }
    style.glow = value.glow;
  }

  if (value.cornerRadius !== undefined) {
    if (typeof value.cornerRadius !== "number") {
      throw new FlowImportError(
        `Invalid flow: ${context}[${index}].style.cornerRadius must be a number.`,
      );
    }
    style.cornerRadius = value.cornerRadius;
  }

  return style;
}

function parseFlowEdgeWaypoints(value: unknown, index: number, context: string): FlowEdgeWaypoint[] {
  if (!Array.isArray(value)) {
    throw new FlowImportError(`Invalid flow: ${context}[${index}].waypoints must be an array when provided.`);
  }
  return value.map((point, pointIndex) => {
    if (!isRecord(point) || typeof point.x !== "number" || typeof point.y !== "number") {
      throw new FlowImportError(
        `Invalid flow: ${context}[${index}].waypoints[${pointIndex}] must have numeric "x" and "y".`,
      );
    }
    return { x: point.x, y: point.y };
  });
}

function parseFlowEdge(value: unknown, index: number, context: string): FlowEdge {
  if (!isRecord(value)) {
    throw new FlowImportError(
      `Invalid flow: ${context}[${index}] must be an object.`
    );
  }

  if (typeof value.id !== "string") {
    throw new FlowImportError(
      `Invalid flow: ${context}[${index}] is missing a valid "id".`
    );
  }

  if (typeof value.source !== "string") {
    throw new FlowImportError(
      `Invalid flow: ${context}[${index}] is missing a valid "source".`
    );
  }

  if (typeof value.target !== "string") {
    throw new FlowImportError(
      `Invalid flow: ${context}[${index}] is missing a valid "target".`
    );
  }

  if (
    value.sourceHandle !== undefined &&
    typeof value.sourceHandle !== "string"
  ) {
    throw new FlowImportError(
      `Invalid flow: ${context}[${index}].sourceHandle must be a string when provided.`
    );
  }

  if (
    value.targetHandle !== undefined &&
    typeof value.targetHandle !== "string"
  ) {
    throw new FlowImportError(
      `Invalid flow: ${context}[${index}].targetHandle must be a string when provided.`
    );
  }

  const edgeLabel =
    value.label !== undefined ? migrateLabel(value.label, `${context}[${index}].label`) : undefined;

  if (
    value.lineStyle !== undefined &&
    !FLOW_EDGE_LINE_STYLES.includes(value.lineStyle as FlowEdgeLineStyle)
  ) {
    throw new FlowImportError(
      `Invalid flow: ${context}[${index}].lineStyle must be "solid" or "dashed" when provided.`
    );
  }

  if (
    value.arrow !== undefined &&
    !FLOW_EDGE_ARROWS.includes(value.arrow as FlowEdgeArrow)
  ) {
    throw new FlowImportError(
      `Invalid flow: ${context}[${index}].arrow must be "none", "forward", or "both" when provided.`
    );
  }

  if (
    value.arrowStart !== undefined &&
    !FLOW_EDGE_ARROWS.includes(value.arrowStart as FlowEdgeArrow)
  ) {
    throw new FlowImportError(
      `Invalid flow: ${context}[${index}].arrowStart must be "none", "forward", or "both" when provided.`
    );
  }

  if (
    value.arrowEnd !== undefined &&
    !FLOW_EDGE_ARROWS.includes(value.arrowEnd as FlowEdgeArrow)
  ) {
    throw new FlowImportError(
      `Invalid flow: ${context}[${index}].arrowEnd must be "none", "forward", or "both" when provided.`
    );
  }

  if (
    value.arrowStartShape !== undefined &&
    !FLOW_EDGE_ARROW_SHAPES.includes(value.arrowStartShape as FlowEdgeArrowShape)
  ) {
    throw new FlowImportError(
      `Invalid flow: ${context}[${index}].arrowStartShape must be "triangle" or "open" when provided.`
    );
  }

  if (
    value.arrowEndShape !== undefined &&
    !FLOW_EDGE_ARROW_SHAPES.includes(value.arrowEndShape as FlowEdgeArrowShape)
  ) {
    throw new FlowImportError(
      `Invalid flow: ${context}[${index}].arrowEndShape must be "triangle" or "open" when provided.`
    );
  }

  if (value.stroke !== undefined && typeof value.stroke !== "string") {
    throw new FlowImportError(
      `Invalid flow: ${context}[${index}].stroke must be a string when provided.`,
    );
  }

  if (value.strokeWidth !== undefined && typeof value.strokeWidth !== "number") {
    throw new FlowImportError(
      `Invalid flow: ${context}[${index}].strokeWidth must be a number when provided.`,
    );
  }

  if (value.layerId !== undefined && typeof value.layerId !== "string") {
    throw new FlowImportError(
      `Invalid flow: ${context}[${index}].layerId must be a string when provided.`,
    );
  }

  if (value.routing !== undefined && !FLOW_EDGE_ROUTINGS.includes(value.routing as FlowEdgeRouting)) {
    throw new FlowImportError(
      `Invalid flow: ${context}[${index}].routing must be "straight", "orthogonal", or "curved" when provided.`,
    );
  }

  const waypoints =
    value.waypoints !== undefined ? parseFlowEdgeWaypoints(value.waypoints, index, context) : undefined;

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

  if (edgeLabel !== undefined) {
    edge.label = edgeLabel;
  }

  if (typeof value.lineStyle === "string") {
    edge.lineStyle = value.lineStyle as FlowEdgeLineStyle;
  }

  if (typeof value.arrow === "string") {
    edge.arrow = value.arrow as FlowEdgeArrow;
  }

  if (typeof value.arrowStart === "string") {
    edge.arrowStart = value.arrowStart as FlowEdgeArrow;
  }

  if (typeof value.arrowEnd === "string") {
    edge.arrowEnd = value.arrowEnd as FlowEdgeArrow;
  }

  if (typeof value.arrowStartShape === "string") {
    edge.arrowStartShape = value.arrowStartShape as FlowEdgeArrowShape;
  }

  if (typeof value.arrowEndShape === "string") {
    edge.arrowEndShape = value.arrowEndShape as FlowEdgeArrowShape;
  }

  if (typeof value.stroke === "string") {
    edge.stroke = value.stroke;
  }

  if (typeof value.strokeWidth === "number") {
    edge.strokeWidth = value.strokeWidth;
  }

  if (typeof value.layerId === "string") {
    edge.layerId = value.layerId;
  }

  if (typeof value.routing === "string") {
    edge.routing = value.routing as FlowEdgeRouting;
  }

  if (waypoints !== undefined) {
    edge.waypoints = waypoints;
  }

  return edge;
}

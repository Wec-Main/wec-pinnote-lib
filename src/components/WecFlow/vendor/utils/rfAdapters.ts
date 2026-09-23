import { MarkerType, type Node, type Edge } from "@xyflow/react";
import type {
  FlowNode,
  FlowNodeStyle,
  FlowEdge,
  FlowEdgeArrow,
  FlowEdgeArrowShape,
  FlowEdgeLineStyle,
  FlowEdgeRouting,
  FlowEdgeWaypoint,
  FlowNodeData,
  FlowNodeType,
} from "../types/flow.types";
import { plainTextToRichText, richTextToPlainText } from "./richText";

export type RFNode = Node<FlowNodeData, FlowNodeType>;
export interface RFEdgeData {
  layerId?: string;
  routing?: FlowEdgeRouting;
  waypoints?: FlowEdgeWaypoint[];
  [key: string]: unknown;
}
export type RFEdge = Edge<RFEdgeData>;

export function toRFNode(node: FlowNode): RFNode {
  const data: FlowNodeData = { ...node.data };
  if (node.layerId !== undefined) data.layerId = node.layerId;
  if (node.style !== undefined) data.style = node.style;
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    data,
    draggable: node.locked ? false : undefined,
    width: node.width,
    height: node.height,
  };
}

export function fromRFNode(node: RFNode): FlowNode {
  const flowNode: FlowNode = {
    id: node.id,
    type: (node.type ?? "process") as FlowNodeType,
    position: { x: node.position.x, y: node.position.y },
    data: {
      label: node.data.label,
      description: node.data.description,
      groupId: node.data.groupId,
    },
  };
  const style = node.data.style as FlowNodeStyle | undefined;
  if (style) flowNode.style = style;
  if (node.draggable === false) flowNode.locked = true;
  if (typeof node.data.layerId === "string") flowNode.layerId = node.data.layerId;
  if (typeof node.width === "number") flowNode.width = node.width;
  if (typeof node.height === "number") flowNode.height = node.height;
  return flowNode;
}

function markerForShape(shape: FlowEdgeArrowShape | undefined): { type: MarkerType } {
  return shape === "open" ? { type: MarkerType.Arrow } : { type: MarkerType.ArrowClosed };
}

function markerForArrowEnd(
  arrow: FlowEdgeArrow | undefined,
  shape: FlowEdgeArrowShape | undefined,
): RFEdge["markerEnd"] {
  return arrow === "none" ? undefined : markerForShape(shape);
}

function markerForArrowStart(
  arrow: FlowEdgeArrow | undefined,
  shape: FlowEdgeArrowShape | undefined,
): RFEdge["markerStart"] {
  return arrow === "both" ? markerForShape(shape) : undefined;
}

function resolvedArrowEnds(edge: FlowEdge): { start: FlowEdgeArrow; end: FlowEdgeArrow } {
  if (edge.arrowStart !== undefined || edge.arrowEnd !== undefined) {
    return {
      start: edge.arrowStart ?? "none",
      end: edge.arrowEnd ?? "none",
    };
  }
  const legacy = edge.arrow ?? "forward";
  if (legacy === "both") return { start: "both", end: "both" };
  if (legacy === "none") return { start: "none", end: "none" };
  return { start: "none", end: "forward" };
}

const DASH_PATTERNS: Record<FlowEdgeLineStyle, string | undefined> = {
  solid: undefined,
  dashed: "6 4",
  dotted: "1 4",
};

function styleForEdge(edge: FlowEdge): RFEdge["style"] {
  const inline: Record<string, string | number> = {};
  const dash = DASH_PATTERNS[edge.lineStyle ?? "solid"];
  if (dash) inline.strokeDasharray = dash;
  if (edge.stroke !== undefined) inline.stroke = edge.stroke;
  if (edge.strokeWidth !== undefined) inline.strokeWidth = edge.strokeWidth;
  return Object.keys(inline).length > 0 ? inline : undefined;
}

function edgeData(edge: FlowEdge): RFEdgeData | undefined {
  if (edge.layerId === undefined && edge.routing === undefined && edge.waypoints === undefined) {
    return undefined;
  }
  return { layerId: edge.layerId, routing: edge.routing, waypoints: edge.waypoints };
}

const RF_TYPE_FOR_ROUTING: Record<FlowEdgeRouting, RFEdge["type"]> = {
  straight: "straight",
  orthogonal: "smoothstep",
  curved: "default",
};

const ROUTING_FOR_RF_TYPE: Record<string, FlowEdgeRouting> = {
  straight: "straight",
  smoothstep: "orthogonal",
  step: "orthogonal",
  default: "curved",
  bezier: "curved",
};

export function toRFEdge(edge: FlowEdge): RFEdge {
  const { start, end } = resolvedArrowEnds(edge);
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    label: edge.label ? richTextToPlainText(edge.label) : undefined,
    type: edge.routing ? RF_TYPE_FOR_ROUTING[edge.routing] : undefined,
    style: styleForEdge(edge),
    data: edgeData(edge),
    markerStart: markerForArrowStart(
      start === "both" ? "both" : start === "none" ? "none" : "forward",
      edge.arrowStartShape,
    ),
    markerEnd: markerForArrowEnd(end, edge.arrowEndShape),
  };
}

function lineStyleFromDasharray(dasharray: unknown): FlowEdgeLineStyle {
  if (dasharray === "1 4") return "dotted";
  if (dasharray) return "dashed";
  return "solid";
}

function shapeFromMarker(marker: RFEdge["markerStart"]): FlowEdgeArrowShape {
  if (marker && typeof marker === "object" && marker.type === MarkerType.Arrow) return "open";
  return "triangle";
}

function arrowEndsFromMarkers(edge: RFEdge): { arrowStart: FlowEdgeArrow; arrowEnd: FlowEdgeArrow } {
  return {
    arrowStart: edge.markerStart !== undefined ? "both" : "none",
    arrowEnd: edge.markerEnd !== undefined ? "forward" : "none",
  };
}

export function fromRFEdge(edge: RFEdge): FlowEdge {
  const style = edge.style as Record<string, unknown> | undefined;
  const { arrowStart, arrowEnd } = arrowEndsFromMarkers(edge);
  const flowEdge: FlowEdge = {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
    label: typeof edge.label === "string" ? plainTextToRichText(edge.label) : undefined,
    lineStyle: lineStyleFromDasharray(style?.strokeDasharray),
    arrow: arrowStart === "both" ? "both" : arrowEnd === "none" ? "none" : "forward",
    arrowStart,
    arrowEnd,
    arrowStartShape: shapeFromMarker(edge.markerStart),
    arrowEndShape: shapeFromMarker(edge.markerEnd),
  };
  if (style && typeof style.stroke === "string") flowEdge.stroke = style.stroke;
  if (style && typeof style.strokeWidth === "number") flowEdge.strokeWidth = style.strokeWidth;
  if (edge.data?.layerId !== undefined) flowEdge.layerId = edge.data.layerId;
  if (edge.data?.routing !== undefined) {
    flowEdge.routing = edge.data.routing;
  } else if (edge.type && ROUTING_FOR_RF_TYPE[edge.type]) {
    flowEdge.routing = ROUTING_FOR_RF_TYPE[edge.type];
  }
  if (edge.data?.waypoints !== undefined) flowEdge.waypoints = edge.data.waypoints;
  return flowEdge;
}

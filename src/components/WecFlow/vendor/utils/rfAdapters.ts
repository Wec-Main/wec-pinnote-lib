import { MarkerType, type Node, type Edge } from "@xyflow/react";
import type {
  FlowNode,
  FlowEdge,
  FlowEdgeArrow,
  FlowEdgeLineStyle,
  FlowNodeData,
  FlowNodeType,
} from "../types/flow.types";

export type RFNode = Node<FlowNodeData, FlowNodeType>;
export type RFEdge = Edge;

export function toRFNode(node: FlowNode): RFNode {
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    data: node.data,
  };
}

export function fromRFNode(node: RFNode): FlowNode {
  return {
    id: node.id,
    type: (node.type ?? "process") as FlowNodeType,
    position: { x: node.position.x, y: node.position.y },
    data: {
      label: node.data.label,
      description: node.data.description,
    },
  };
}

const ARROW_MARKER = { type: MarkerType.ArrowClosed };

function markersForArrow(arrow: FlowEdgeArrow | undefined): Pick<RFEdge, "markerStart" | "markerEnd"> {
  switch (arrow) {
    case "both":
      return { markerStart: ARROW_MARKER, markerEnd: ARROW_MARKER };
    case "none":
      return { markerStart: undefined, markerEnd: undefined };
    case "forward":
    default:
      return { markerStart: undefined, markerEnd: ARROW_MARKER };
  }
}

function styleForLineStyle(lineStyle: FlowEdgeLineStyle | undefined): RFEdge["style"] {
  return lineStyle === "dashed" ? { strokeDasharray: "6 4" } : undefined;
}

export function toRFEdge(edge: FlowEdge): RFEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    label: edge.label,
    style: styleForLineStyle(edge.lineStyle),
    ...markersForArrow(edge.arrow),
  };
}

function arrowFromMarkers(edge: RFEdge): FlowEdgeArrow {
  const hasStart = edge.markerStart !== undefined;
  const hasEnd = edge.markerEnd !== undefined;
  if (hasStart && hasEnd) return "both";
  if (!hasStart && !hasEnd) return "none";
  return "forward";
}

export function fromRFEdge(edge: RFEdge): FlowEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
    label: typeof edge.label === "string" ? edge.label : undefined,
    lineStyle: edge.style?.strokeDasharray ? "dashed" : "solid",
    arrow: arrowFromMarkers(edge),
  };
}

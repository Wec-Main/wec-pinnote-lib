import type { Node, Edge } from "@xyflow/react";
import type { FlowNode, FlowEdge, FlowNodeData, FlowNodeType } from "../types/flow.types";

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

export function toRFEdge(edge: FlowEdge): RFEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    label: edge.label,
  };
}

export function fromRFEdge(edge: RFEdge): FlowEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
    label: typeof edge.label === "string" ? edge.label : undefined,
  };
}

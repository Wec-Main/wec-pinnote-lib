import type { ReactNode } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import type { FlowNodeData, FlowNodeType } from "../../types/flow.types";
import { FourSidedHandles, NodeShell } from "./NodeShell";
import { useNodeLabelEditing } from "./useNodeLabelEditing";

export type BasicShapeVariant = Exclude<
  FlowNodeType,
  "start" | "end" | "process" | "decision" | "input" | "output"
>;

/**
 * Shared renderer for every basic-shapes-palette node type (rectangle,
 * ellipse, diamond, parallelogram, triangle, hexagon, cylinder, cloud,
 * document, text, container). Geometry differences are pure CSS
 * (nodes.css, `.wec-flow-node--{variant}`); connectable from/to any side via
 * FourSidedHandles like the flowchart-category shapes.
 */
export function createBasicShapeNode(
  variant: BasicShapeVariant,
): (props: NodeProps<Node<FlowNodeData, FlowNodeType>>) => ReactNode {
  return function BasicShapeNode({ id, data, selected, width, height }): ReactNode {
    const editing = useNodeLabelEditing(id);
    return (
      <NodeShell
        variant={variant}
        label={data.label}
        style={data.style}
        selected={selected}
        nodeId={id}
        width={width}
        height={height}
        {...editing}
      >
        <FourSidedHandles />
      </NodeShell>
    );
  };
}

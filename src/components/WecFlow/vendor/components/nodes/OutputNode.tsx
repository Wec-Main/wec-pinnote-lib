import type { ReactNode } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import type { FlowNodeData, FlowNodeType } from "../../types/flow.types";
import { FourSidedHandles, NodeShell } from "./NodeShell";
import { useNodeLabelEditing } from "./useNodeLabelEditing";

/**
 * Output node: represents data leaving the flow, connectable from/to any
 * side (e.g. to feed into further processing or termination).
 */
export function OutputNode({
  id,
  data,
  selected,
  width,
  height,
}: NodeProps<Node<FlowNodeData, FlowNodeType>>): ReactNode {
  const editing = useNodeLabelEditing(id);
  return (
    <NodeShell
      variant="output"
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
}

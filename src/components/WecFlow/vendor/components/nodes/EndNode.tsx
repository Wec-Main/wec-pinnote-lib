import type { ReactNode } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import type { FlowNodeData, FlowNodeType } from "../../types/flow.types";
import { FourSidedHandles, NodeShell } from "./NodeShell";
import { useNodeLabelEditing } from "./useNodeLabelEditing";

/**
 * End node: terminal point of a flow, connectable from/to any side like the
 * other shapes (see FourSidedHandles).
 */
export function EndNode({
  id,
  data,
  selected,
  width,
  height,
}: NodeProps<Node<FlowNodeData, FlowNodeType>>): ReactNode {
  const editing = useNodeLabelEditing(id);
  return (
    <NodeShell
      variant="end"
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

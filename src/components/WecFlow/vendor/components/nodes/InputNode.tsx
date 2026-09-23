import type { ReactNode } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import type { FlowNodeData, FlowNodeType } from "../../types/flow.types";
import { FourSidedHandles, NodeShell } from "./NodeShell";
import { useNodeLabelEditing } from "./useNodeLabelEditing";

/**
 * Input node: represents data/user input entering the flow, connectable
 * from/to any side.
 */
export function InputNode({
  id,
  data,
  selected,
  width,
  height,
}: NodeProps<Node<FlowNodeData, FlowNodeType>>): ReactNode {
  const editing = useNodeLabelEditing(id);
  return (
    <NodeShell
      variant="input"
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

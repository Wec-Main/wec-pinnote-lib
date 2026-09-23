import type { ReactNode } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import type { FlowNodeData, FlowNodeType } from "../../types/flow.types";
import { FourSidedHandles, NodeShell } from "./NodeShell";
import { useNodeLabelEditing } from "./useNodeLabelEditing";

/**
 * Decision node: branching step, connectable from/to any side. A single
 * handle can fan out to multiple outgoing edges.
 */
export function DecisionNode({
  id,
  data,
  selected,
  width,
  height,
}: NodeProps<Node<FlowNodeData, FlowNodeType>>): ReactNode {
  const editing = useNodeLabelEditing(id);
  return (
    <NodeShell
      variant="decision"
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

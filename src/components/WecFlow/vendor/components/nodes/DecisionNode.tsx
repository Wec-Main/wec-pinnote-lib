import type { ReactNode } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import type { FlowNodeData, FlowNodeType } from "../../types/flow.types";
import { FourSidedHandles, NodeShell } from "./NodeShell";

/**
 * Decision node: branching step, connectable from/to any side. A single
 * handle can fan out to multiple outgoing edges.
 */
export function DecisionNode({
  data,
  selected,
}: NodeProps<Node<FlowNodeData, FlowNodeType>>): ReactNode {
  return (
    <NodeShell variant="decision" label={data.label} selected={selected}>
      <FourSidedHandles />
    </NodeShell>
  );
}

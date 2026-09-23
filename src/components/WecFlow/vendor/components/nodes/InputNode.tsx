import type { ReactNode } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import type { FlowNodeData, FlowNodeType } from "../../types/flow.types";
import { FourSidedHandles, NodeShell } from "./NodeShell";

/**
 * Input node: represents data/user input entering the flow, connectable
 * from/to any side.
 */
export function InputNode({
  data,
  selected,
}: NodeProps<Node<FlowNodeData, FlowNodeType>>): ReactNode {
  return (
    <NodeShell variant="input" label={data.label} selected={selected}>
      <FourSidedHandles />
    </NodeShell>
  );
}

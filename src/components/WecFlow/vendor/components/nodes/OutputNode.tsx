import type { ReactNode } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import type { FlowNodeData, FlowNodeType } from "../../types/flow.types";
import { FourSidedHandles, NodeShell } from "./NodeShell";

/**
 * Output node: represents data leaving the flow, connectable from/to any
 * side (e.g. to feed into further processing or termination).
 */
export function OutputNode({
  data,
  selected,
}: NodeProps<Node<FlowNodeData, FlowNodeType>>): ReactNode {
  return (
    <NodeShell variant="output" label={data.label} selected={selected}>
      <FourSidedHandles />
    </NodeShell>
  );
}

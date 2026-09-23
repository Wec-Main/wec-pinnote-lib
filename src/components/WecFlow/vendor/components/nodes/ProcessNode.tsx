import type { ReactNode } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import type { FlowNodeData, FlowNodeType } from "../../types/flow.types";
import { FourSidedHandles, NodeShell } from "./NodeShell";

/**
 * Process node: a generic step, connectable from/to any side.
 */
export function ProcessNode({
  data,
  selected,
}: NodeProps<Node<FlowNodeData, FlowNodeType>>): ReactNode {
  return (
    <NodeShell variant="process" label={data.label} selected={selected}>
      <FourSidedHandles />
    </NodeShell>
  );
}

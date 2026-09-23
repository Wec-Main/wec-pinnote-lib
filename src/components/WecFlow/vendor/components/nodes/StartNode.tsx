import type { ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import type { FlowNodeData, FlowNodeType } from "../../types/flow.types";
import { NodeShell } from "./NodeShell";

/**
 * Start node: entry point of a flow. Has outgoing (source) handles on all
 * four sides and intentionally no incoming (target) handle.
 */
export function StartNode({
  data,
  selected,
}: NodeProps<Node<FlowNodeData, FlowNodeType>>): ReactNode {
  return (
    <NodeShell variant="start" label={data.label} selected={selected}>
      <Handle type="source" position={Position.Top} id="top" className="wec-flow-node__handle" />
      <Handle type="source" position={Position.Right} id="right" className="wec-flow-node__handle" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="wec-flow-node__handle" />
      <Handle type="source" position={Position.Left} id="left" className="wec-flow-node__handle" />
    </NodeShell>
  );
}

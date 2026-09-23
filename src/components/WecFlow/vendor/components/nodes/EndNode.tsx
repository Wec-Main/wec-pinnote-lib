import type { ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import type { FlowNodeData, FlowNodeType } from "../../types/flow.types";
import { NodeShell } from "./NodeShell";

/**
 * End node: terminal point of a flow. Has incoming (target) handles on all
 * four sides and intentionally no outgoing (source) handle.
 */
export function EndNode({
  data,
  selected,
}: NodeProps<Node<FlowNodeData, FlowNodeType>>): ReactNode {
  return (
    <NodeShell variant="end" label={data.label} selected={selected}>
      <Handle type="target" position={Position.Top} id="top" className="wec-flow-node__handle" />
      <Handle type="target" position={Position.Right} id="right" className="wec-flow-node__handle" />
      <Handle type="target" position={Position.Bottom} id="bottom" className="wec-flow-node__handle" />
      <Handle type="target" position={Position.Left} id="left" className="wec-flow-node__handle" />
    </NodeShell>
  );
}

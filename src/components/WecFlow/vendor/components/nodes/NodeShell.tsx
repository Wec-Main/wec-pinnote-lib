import type { ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import type { FlowNodeType } from "../../types/flow.types";

export interface NodeShellProps {
  /** Node type variant, used to derive the `wec-flow-node--{variant}` class. */
  variant: FlowNodeType;
  label: string;
  selected?: boolean;
  /** Handle elements rendered around the shape. */
  children?: ReactNode;
}

/**
 * Shared shell for all flow node components. Renders the node as its real
 * flowchart shape (circle, rectangle, diamond, parallelogram — see
 * nodes.css) with the label centered inside. Descriptions are edited via the
 * properties panel only, not shown on the canvas.
 */
export function NodeShell({
  variant,
  label,
  selected,
  children,
}: NodeShellProps): ReactNode {
  const className = [
    "wec-flow-node",
    `wec-flow-node--${variant}`,
    selected ? "wec-flow-node--selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className} title={label}>
      {children}
      <span className="wec-flow-node__label">{label}</span>
    </div>
  );
}

const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left] as const;

/**
 * Renders a connectable target+source handle pair on every side of the node,
 * for node types where a connection may both enter and leave from any side
 * (Process, Decision, Input, Output). A target and source handle at the same
 * `position` land on the exact same spot, so each side still shows as a
 * single dot; xyflow's own connection-drop detection distinguishes them by
 * type, not DOM order, so the overlap doesn't cause ambiguity.
 */
export function FourSidedHandles(): ReactNode {
  return (
    <>
      {SIDES.map((side) => (
        <Handle
          key={`${side}-target`}
          type="target"
          position={side}
          id={`${side}-target`}
          className="wec-flow-node__handle"
        />
      ))}
      {SIDES.map((side) => (
        <Handle
          key={`${side}-source`}
          type="source"
          position={side}
          id={`${side}-source`}
          className="wec-flow-node__handle"
        />
      ))}
    </>
  );
}

import { useRef, type CSSProperties, type FocusEvent, type PointerEvent, type ReactNode } from "react";
import { Handle, NodeResizer, Position, useReactFlow } from "@xyflow/react";
import type { FlowNodeStyle, FlowNodeType, RichText } from "../../types/flow.types";
import { plainTextToRichText, richTextToPlainText } from "../../utils/richText";

export interface NodeShellProps {
  /** Node type variant, used to derive the `wec-flow-node--{variant}` class. */
  variant: FlowNodeType;
  label: RichText;
  style?: FlowNodeStyle;
  selected?: boolean;
  editing?: boolean;
  onStartEdit?: () => void;
  onCommitEdit?: (label: RichText) => void;
  nodeId?: string;
  readonly?: boolean;
  width?: number;
  height?: number;
  onResizeEnd?: (width: number, height: number) => void;
  onRotate?: (degrees: number) => void;
  /** Handle elements rendered around the shape. */
  children?: ReactNode;
}

function shapeStyle(style: FlowNodeStyle | undefined): CSSProperties | undefined {
  if (!style) return undefined;
  const css: CSSProperties & Record<string, string | number> = {};
  if (style.fill !== undefined) {
    css.backgroundColor = style.fill;
    css["--wec-flow-node-fill"] = style.fill;
  }
  if (style.stroke !== undefined) {
    css.borderColor = style.stroke;
    css["--wec-flow-node-stroke"] = style.stroke;
  }
  if (style.strokeWidth !== undefined) css.borderWidth = style.strokeWidth;
  if (style.opacity !== undefined) css.opacity = style.opacity / 100;
  if (style.rotation !== undefined) css.transform = `rotate(${style.rotation}deg)`;
  if (style.perimeter !== undefined) css.padding = style.perimeter;
  if (style.cornerRadius !== undefined) css.borderRadius = style.cornerRadius;
  const shadows: string[] = [];
  if (style.shadow) shadows.push("0 4px 12px rgba(0, 0, 0, 0.45)");
  if (style.glow) shadows.push(`0 0 10px ${style.stroke ?? "#3b82f6"}`);
  if (shadows.length > 0) css.boxShadow = shadows.join(", ");
  return Object.keys(css).length > 0 ? css : undefined;
}

interface RotateHandleProps {
  nodeId?: string;
  onRotate?: (degrees: number) => void;
}

function angleFromCenter(centerX: number, centerY: number, pointerX: number, pointerY: number): number {
  const radians = Math.atan2(pointerY - centerY, pointerX - centerX);
  return (radians * 180) / Math.PI + 90;
}

function RotateHandle({ nodeId, onRotate }: RotateHandleProps): ReactNode {
  const { flowToScreenPosition, getNode } = useReactFlow();
  const draggingRef = useRef(false);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    event.stopPropagation();
    event.preventDefault();
    const node = nodeId ? getNode(nodeId) : undefined;
    if (!node) return;
    const width = node.measured?.width ?? node.width ?? 0;
    const height = node.measured?.height ?? node.height ?? 0;
    const centerFlow = {
      x: node.position.x + width / 2,
      y: node.position.y + height / 2,
    };
    const centerScreen = flowToScreenPosition(centerFlow);
    draggingRef.current = true;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);

    const handleMove = (moveEvent: globalThis.PointerEvent): void => {
      if (!draggingRef.current) return;
      const degrees = angleFromCenter(
        centerScreen.x,
        centerScreen.y,
        moveEvent.clientX,
        moveEvent.clientY,
      );
      onRotate?.(Math.round(degrees));
    };

    const handleUp = (upEvent: globalThis.PointerEvent): void => {
      draggingRef.current = false;
      const degrees = angleFromCenter(centerScreen.x, centerScreen.y, upEvent.clientX, upEvent.clientY);
      onRotate?.(Math.round(degrees));
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  return (
    <div className="wec-flow-node__rotate-handle-wrapper" aria-hidden="true">
      <div className="wec-flow-node__rotate-handle-line" />
      <div
        className="wec-flow-node__rotate-handle"
        role="slider"
        aria-label="Rotate shape"
        aria-valuenow={0}
        tabIndex={-1}
        onPointerDown={handlePointerDown}
      />
    </div>
  );
}

function labelStyle(label: RichText): CSSProperties {
  return {
    textAlign: label.align,
    lineHeight: label.lineHeight,
    letterSpacing: label.letterSpacing !== undefined ? `${label.letterSpacing}px` : undefined,
    textTransform: label.transform && label.transform !== "none" ? label.transform : undefined,
    marginTop: label.spacing,
    marginBottom: label.spacing,
  };
}

function runStyle(run: RichText["runs"][number]): CSSProperties {
  return {
    fontWeight: run.bold ? 700 : undefined,
    fontStyle: run.italic ? "italic" : undefined,
    textDecoration:
      [run.underline ? "underline" : "", run.strike ? "line-through" : ""]
        .filter(Boolean)
        .join(" ") || undefined,
    color: run.color,
    fontFamily: run.fontFamily,
    fontSize: run.fontSize,
  };
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
  style,
  selected,
  editing = false,
  onStartEdit,
  onCommitEdit,
  nodeId,
  readonly = false,
  width,
  height,
  onResizeEnd,
  onRotate,
  children,
}: NodeShellProps): ReactNode {
  const editableRef = useRef<HTMLSpanElement>(null);
  const className = [
    "wec-flow-node",
    `wec-flow-node--${variant}`,
    selected ? "wec-flow-node--selected" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const nodeStyle: CSSProperties | undefined =
    width !== undefined || height !== undefined || style !== undefined
      ? { width, height, ...shapeStyle(style) }
      : undefined;

  const handleBlur = (event: FocusEvent<HTMLSpanElement>): void => {
    onCommitEdit?.(plainTextToRichText(event.currentTarget.textContent ?? ""));
  };

  const resizer = selected && !readonly && (
    <NodeResizer
      nodeId={nodeId}
      minWidth={40}
      minHeight={24}
      onResizeEnd={(_event, params) => onResizeEnd?.(params.width, params.height)}
    />
  );

  const rotateHandle = selected && !readonly && (
    <RotateHandle nodeId={nodeId} onRotate={onRotate} />
  );

  if (editing) {
    return (
      <div className={className} title={richTextToPlainText(label)} style={nodeStyle}>
        {resizer}
        {rotateHandle}
        {children}
        <span
          ref={editableRef}
          className="wec-flow-node__label wec-flow-node__label--editing"
          style={labelStyle(label)}
          contentEditable
          suppressContentEditableWarning
          onBlur={handleBlur}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {richTextToPlainText(label)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={className}
      title={richTextToPlainText(label)}
      onDoubleClick={onStartEdit}
      style={nodeStyle}
    >
      {resizer}
      {rotateHandle}
      {children}
      <span
        className="wec-flow-node__label"
        style={labelStyle(label)}
      >
        {label.runs.map((run, index) => (
          <span key={index} style={runStyle(run)}>
            {run.text}
          </span>
        ))}
      </span>
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

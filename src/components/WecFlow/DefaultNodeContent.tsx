import { useEffect, useRef, useState } from "react";
import { useFlowEngine } from "../../context/FlowContext";
import type { NodeComponentProps } from "../../utils/flowchart/nodeTypes";
import { cx } from "../../utils/flowchart/shallow";
import { NodeIcon } from "./FlowIcons";

/** Default body: icon badge, label and description, laid out according to the node shape. */
export function DefaultNodeContent({
  node,
  definition,
  height,
  editing,
  onEditDone,
}: NodeComponentProps) {
  const engine = useFlowEngine();
  const compact = definition.shape === "diamond" || definition.shape === "pill";
  const showDescription =
    !!node.data.description && (definition.shape === "diamond" ? height >= 140 : height >= 64);
  const [draft, setDraft] = useState(node.data.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) setDraft(node.data.label);
  }, [editing, node.data.label]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (editing) {
    const commit = () => {
      const value = draft.trim();
      if (value !== node.data.label) engine.updateNodeData(node.id, { label: value });
      onEditDone?.();
    };
    return (
      <div
        className={cx("wpn-flowchart-node__body", compact && "wpn-flowchart-node__body-centered")}
      >
        <input
          ref={inputRef}
          autoFocus
          className="wpn-flowchart-node__label-edit"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") onEditDone?.();
          }}
        />
      </div>
    );
  }

  const showIcon =
    definition.icon !== undefined && (definition.role === "start" || definition.role === "end");

  return (
    <div
      className={cx(
        "wpn-flowchart-node__body",
        compact && "wpn-flowchart-node__body-centered",
        definition.shape === "diamond" && "wpn-flowchart-node__body-diamond",
      )}
    >
      {showIcon && (
        <span
          className={cx("wpn-flowchart-node__badge", compact && "wpn-flowchart-node__badge-small")}
        >
          <NodeIcon icon={definition.icon} size={compact ? 13 : 16} />
        </span>
      )}
      <div className="wpn-flowchart-node__text">
        <div className="wpn-flowchart-node__label" title={node.data.label}>
          {node.data.label || <span className="wpn-flowchart-node__placeholder">Untitled</span>}
        </div>
        {showDescription && (
          <div className="wpn-flowchart-node__description">{node.data.description}</div>
        )}
      </div>
    </div>
  );
}

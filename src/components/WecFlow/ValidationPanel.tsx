import { memo, useEffect } from "react";
import { useFlowEngine, useFlowState } from "../../context/FlowContext";
import type { ValidationIssue } from "../../utils/flowchart/validator";
import { cx } from "../../utils/flowchart/shallow";
import { Icon } from "./FlowIcons";

/**
 * Shows the result of the last validation run. While open it re-validates
 * automatically (debounced) as the flow changes, so fixes are reflected live.
 */
export const ValidationPanel = memo(function ValidationPanel() {
  const engine = useFlowEngine();
  const result = useFlowState((s) => s.validation);
  const nodes = useFlowState((s) => s.nodes);
  const edges = useFlowState((s) => s.edges);
  const open = result !== null;

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => engine.validate(), 250);
    return () => clearTimeout(t);
  }, [engine, open, nodes, edges]);

  if (!result) return null;

  const focusIssue = (issue: ValidationIssue) => {
    const nodeIds = issue.nodeIds ?? [];
    engine.setSelection(nodeIds, issue.edgeIds ?? []);
    if (nodeIds.length) engine.fitView({ nodeIds, padding: 160, maxZoom: 1.1 });
  };

  return (
    <div
      className="wpn-flowchart-validation__panel"
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className={cx(
          "wpn-flowchart-validation__header",
          result.valid ? "wpn-flowchart-validation__ok" : "wpn-flowchart-validation__bad",
        )}
      >
        <Icon name={result.valid ? "success" : "alert"} size={16} />
        <span className="wpn-flowchart-validation__summary">
          {result.valid
            ? result.warningCount
              ? `Valid, with ${result.warningCount} warning${result.warningCount > 1 ? "s" : ""}`
              : "Flow is valid"
            : `${result.errorCount} error${result.errorCount > 1 ? "s" : ""}${result.warningCount ? `, ${result.warningCount} warning${result.warningCount > 1 ? "s" : ""}` : ""}`}
        </span>
        <button
          type="button"
          className="wpn-flowchart-validation__close"
          onClick={() => engine.clearValidation()}
          title="Close"
        >
          <Icon name="x" size={14} />
        </button>
      </div>
      {result.issues.length > 0 && (
        <ul className="wpn-flowchart-validation__list">
          {result.issues.map((issue) => (
            <li key={issue.id}>
              <button
                type="button"
                className="wpn-flowchart-validation__issue"
                onClick={() => focusIssue(issue)}
                disabled={!issue.nodeIds?.length && !issue.edgeIds?.length}
              >
                <span
                  className={cx(
                    "wpn-flowchart-validation__dot",
                    `wpn-flowchart-validation__${issue.severity}`,
                  )}
                />
                <span className="wpn-flowchart-validation__message">{issue.message}</span>
                {!!issue.nodeIds?.length && <Icon name="chevron" size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

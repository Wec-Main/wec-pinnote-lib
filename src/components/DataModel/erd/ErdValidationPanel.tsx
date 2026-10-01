import { memo, useEffect } from "react";
import { useErdEngine, useErdState } from "../../../context/ErdContext";
import type { ErdValidationIssue } from "../../../utils/erd/erdValidator";
import { cx } from "../../../utils/flowchart/shallow";
import { Icon } from "../../WecFlow/FlowIcons";

const REVALIDATE_DELAY_MS = 250;
const FOCUS_OPTIONS = { padding: 160, maxZoom: 1.1 } as const;

export const ErdValidationPanel = memo(function ErdValidationPanel() {
  const engine = useErdEngine();
  const result = useErdState((s) => s.validation);
  const entities = useErdState((s) => s.entities);
  const relationships = useErdState((s) => s.relationships);
  const enums = useErdState((s) => s.enums);
  const modelEngine = useErdState((s) => s.engine);
  const open = result !== null;

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => engine.validate(), REVALIDATE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [engine, open, entities, relationships, enums, modelEngine]);

  if (!result) return null;

  const focusIssue = (issue: ErdValidationIssue) => {
    if (issue.relationshipId) {
      const rel = engine.getRelationship(issue.relationshipId);
      engine.select("relationship", issue.relationshipId);
      if (rel) engine.fitView({ ids: [rel.sourceEntityId, rel.targetEntityId], ...FOCUS_OPTIONS });
      return;
    }
    if (issue.entityId) {
      engine.select("entity", issue.entityId);
      engine.fitView({ ids: [issue.entityId], ...FOCUS_OPTIONS });
      return;
    }
    if (issue.enumId) engine.select("enum", issue.enumId);
  };

  const focusable = (issue: ErdValidationIssue) =>
    !!(issue.relationshipId || issue.entityId || issue.enumId);
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

  return (
    <div
      className="wpn-flowchart-validation__panel wpn-erd__validation"
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
              ? `Valid, with ${plural(result.warningCount, "warning")}`
              : "Data model is valid"
            : `${plural(result.errorCount, "error")}${result.warningCount ? `, ${plural(result.warningCount, "warning")}` : ""}`}
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
                disabled={!focusable(issue)}
              >
                <span
                  className={cx(
                    "wpn-flowchart-validation__dot",
                    `wpn-flowchart-validation__${issue.severity}`,
                  )}
                />
                <span className="wpn-flowchart-validation__message">{issue.message}</span>
                {focusable(issue) && <Icon name="chevron" size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

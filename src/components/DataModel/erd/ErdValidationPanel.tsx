import { memo, useEffect, useMemo, useState } from "react";
import { useErdEngine, useErdState } from "../../../context/ErdContext";
import type { ErdValidationIssue } from "../../../utils/erd/erdValidator";
import { cx } from "../../../utils/flowchart/shallow";
import { Icon } from "../../WecFlow/FlowIcons";

const REVALIDATE_DELAY_MS = 250;
const FOCUS_OPTIONS = { padding: 160, maxZoom: 1.1 } as const;

type IssueFilter = "all" | "error" | "warning";

export const ErdValidationPanel = memo(function ErdValidationPanel() {
  const engine = useErdEngine();
  const result = useErdState((s) => s.validation);
  const entities = useErdState((s) => s.entities);
  const relationships = useErdState((s) => s.relationships);
  const enums = useErdState((s) => s.enums);
  const modelEngine = useErdState((s) => s.engine);
  const open = result !== null;
  const [filter, setFilter] = useState<IssueFilter>("all");
  const shown = useMemo(
    () => (result?.issues ?? []).filter((issue) => filter === "all" || issue.severity === filter),
    [filter, result],
  );

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => engine.validate(), REVALIDATE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [engine, open, entities, relationships, enums, modelEngine]);

  if (!result) return null;

  const focusIssue = (issue: ErdValidationIssue) => {
    if (issue.entityId && issue.fieldId) {
      engine.focusField(issue.entityId, issue.fieldId);
      engine.fitView({ ids: [issue.entityId], ...FOCUS_OPTIONS });
      return;
    }
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
        <div className="wpn-erd-validation__tabs" role="tablist" aria-label="Filter issues">
          {(
            [
              ["all", `All ${result.issues.length}`],
              ["error", `Errors ${result.errorCount}`],
              ["warning", `Warnings ${result.warningCount}`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              className={cx(
                "wpn-erd-validation__tab",
                filter === value && "wpn-erd-validation__tab--active",
              )}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {shown.length === 0 && result.issues.length > 0 && (
        <p className="wpn-erd-validation__empty">Nothing in this filter.</p>
      )}
      {shown.length > 0 && (
        <ul className="wpn-flowchart-validation__list">
          {shown.map((issue) => (
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
                <span className="wpn-flowchart-validation__message">
                  {issue.message}
                  {issue.hint ? (
                    <span className="wpn-erd-validation__hint">{issue.hint}</span>
                  ) : null}
                </span>
                {focusable(issue) && <Icon name="chevron" size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

import { memo, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useErdEngine, useErdState } from "../../ErdContext";
import { useFloatingPosition } from "../../../../hooks/useFloatingPosition";
import type { ErdValidationIssue, ErdValidationResult } from "../../../../utils/erd/erdValidator";
import { cx } from "../../../../utils/flowchart/shallow";
import { Icon } from "../../../flowchart/components/FlowIcons";

const REVALIDATE_DELAY_MS = 250;
const COPIED_RESET_MS = 1500;
const FOCUS_OPTIONS = { padding: 160, maxZoom: 1.1 } as const;

type IssueFilter = "all" | "error" | "warning";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

const matchesQuery = (issue: ErdValidationIssue, query: string) =>
  issue.message.toLowerCase().includes(query) || (issue.hint ?? "").toLowerCase().includes(query);

function buildReport(result: ErdValidationResult): string {
  const section = (title: string, issues: ErdValidationIssue[]) =>
    issues.length === 0
      ? ""
      : `${title} (${issues.length})\n${issues.map((issue) => `- ${issue.message}${issue.hint ? ` — ${issue.hint}` : ""}`).join("\n")}`;
  const errors = result.issues.filter((issue) => issue.severity === "error");
  const warnings = result.issues.filter((issue) => issue.severity === "warning");
  const header = result.valid
    ? `Data model is valid${result.warningCount ? ` — ${plural(result.warningCount, "warning")}` : ""}`
    : `${plural(result.errorCount, "error")}, ${plural(result.warningCount, "warning")}`;
  return [header, section("Errors", errors), section("Warnings", warnings)]
    .filter(Boolean)
    .join("\n\n");
}

export const ErdValidationPanel = memo(function ErdValidationPanel({
  anchorRef,
}: {
  anchorRef: RefObject<HTMLButtonElement>;
}) {
  const engine = useErdEngine();
  const result = useErdState((s) => s.validation);
  const entities = useErdState((s) => s.entities);
  const relationships = useErdState((s) => s.relationships);
  const enums = useErdState((s) => s.enums);
  const modelEngine = useErdState((s) => s.engine);
  const open = result !== null;
  const panelRef = useRef<HTMLDivElement>(null);
  const position = useFloatingPosition(anchorRef, panelRef, open, "bottom-start");
  const [filter, setFilter] = useState<IssueFilter>("all");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => engine.validate(), REVALIDATE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [engine, open, entities, relationships, enums, modelEngine]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const normalizedQuery = query.trim().toLowerCase();
  const bySeverity = useMemo(
    () => (result?.issues ?? []).filter((issue) => filter === "all" || issue.severity === filter),
    [filter, result],
  );
  const shown = useMemo(
    () =>
      normalizedQuery
        ? bySeverity.filter((issue) => matchesQuery(issue, normalizedQuery))
        : bySeverity,
    [bySeverity, normalizedQuery],
  );
  const shownErrors = useMemo(() => shown.filter((issue) => issue.severity === "error"), [shown]);
  const shownWarnings = useMemo(
    () => shown.filter((issue) => issue.severity === "warning"),
    [shown],
  );

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

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(buildReport(result));
      setCopied(true);
    } catch {
      // clipboard access denied — nothing to recover, button stays as-is
    }
  };

  const renderIssue = (issue: ErdValidationIssue) => (
    <li key={issue.id}>
      <button
        type="button"
        className="wpn-erd-validation__issue"
        onClick={() => focusIssue(issue)}
        disabled={!focusable(issue)}
      >
        <span
          className={cx(
            "wpn-erd-validation__severity",
            `wpn-erd-validation__severity--${issue.severity}`,
          )}
        >
          <Icon name={issue.severity === "error" ? "x" : "alert"} size={11} />
        </span>
        <span className="wpn-erd-validation__issue-body">
          <span className="wpn-erd-validation__issue-message">{issue.message}</span>
          {issue.hint ? <span className="wpn-erd-validation__hint">{issue.hint}</span> : null}
        </span>
        {focusable(issue) && (
          <Icon name="chevron" size={14} className="wpn-erd-validation__issue-chevron" />
        )}
      </button>
    </li>
  );

  const showSections = filter === "all" && shownErrors.length > 0 && shownWarnings.length > 0;

  return (
    <div
      ref={panelRef}
      className="wpn-erd-validation__panel"
      style={position ? { top: position.top, left: position.left } : { visibility: "hidden" }}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className={cx(
          "wpn-erd-validation__header",
          result.valid ? "wpn-erd-validation__ok" : "wpn-erd-validation__bad",
        )}
      >
        <Icon name={result.valid ? "success" : "alert"} size={16} />
        <span className="wpn-erd-validation__summary">
          {result.valid
            ? result.warningCount
              ? `Valid, with ${plural(result.warningCount, "warning")}`
              : "Data model is valid"
            : `${plural(result.errorCount, "error")}${result.warningCount ? `, ${plural(result.warningCount, "warning")}` : ""}`}
        </span>
        <button
          type="button"
          className="wpn-erd-validation__icon-btn"
          onClick={() => engine.validate()}
          title="Re-check now"
          aria-label="Re-check now"
        >
          <Icon name="refresh" size={14} />
        </button>
        <button
          type="button"
          className="wpn-erd-validation__icon-btn"
          onClick={() => engine.clearValidation()}
          title="Close"
          aria-label="Close"
        >
          <Icon name="x" size={14} />
        </button>
      </div>

      {result.issues.length > 0 && (
        <>
          <div className="wpn-erd-validation__search">
            <Icon name="search" size={13} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search issues…"
              aria-label="Search validation issues"
            />
            {query && (
              <button
                type="button"
                className="wpn-erd-validation__search-clear"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                <Icon name="x" size={11} />
              </button>
            )}
          </div>
          <div className="wpn-erd-validation__tabs" role="tablist" aria-label="Filter issues">
            {(
              [
                ["all", "All", result.issues.length],
                ["error", "Errors", result.errorCount],
                ["warning", "Warnings", result.warningCount],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                className={cx(
                  "wpn-erd-validation__tab",
                  filter === value && "wpn-erd-validation__tab--active",
                  count === 0 && "wpn-erd-validation__tab--empty",
                )}
                onClick={() => setFilter(value)}
              >
                {label} {count}
              </button>
            ))}
          </div>
        </>
      )}

      {shown.length === 0 && result.issues.length > 0 && (
        <p className="wpn-erd-validation__empty">
          {normalizedQuery ? "No issues match your search." : "Nothing in this filter."}
        </p>
      )}

      {shown.length > 0 && (
        <div className="wpn-erd-validation__scroll">
          {showSections ? (
            <>
              <p className="wpn-erd-validation__section-title">Errors · {shownErrors.length}</p>
              <ul className="wpn-erd-validation__list">{shownErrors.map(renderIssue)}</ul>
              <p className="wpn-erd-validation__section-title">Warnings · {shownWarnings.length}</p>
              <ul className="wpn-erd-validation__list">{shownWarnings.map(renderIssue)}</ul>
            </>
          ) : (
            <ul className="wpn-erd-validation__list">{shown.map(renderIssue)}</ul>
          )}
        </div>
      )}

      {result.issues.length > 0 && (
        <div className="wpn-erd-validation__footer">
          <span className="wpn-erd-validation__footer-count">
            {shown.length === result.issues.length
              ? plural(result.issues.length, "issue")
              : `${shown.length} of ${plural(result.issues.length, "issue")}`}
          </span>
          <button
            type="button"
            className="wpn-erd-validation__copy"
            onClick={() => void copyReport()}
          >
            <Icon name={copied ? "success" : "copy"} size={12} />
            {copied ? "Copied" : "Copy report"}
          </button>
        </div>
      )}
    </div>
  );
});

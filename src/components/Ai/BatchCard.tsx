import { useId, useMemo, useState } from "react";
import type { AiOpBatch, AiOpBatchStatus } from "../../types/ai.types";
import { Icon, Spinner } from "../primitives";
import { CHANGE_MARKS, describeOpBatch } from "./aiOpChanges";

export function batchStatusLabel(batch: Pick<AiOpBatch, "status" | "savedRevision">): string {
  const labels: Record<AiOpBatchStatus, string> = {
    proposed: "Proposed",
    applied: "Applied (unsaved)",
    saved: batch.savedRevision !== null ? `Saved rev ${batch.savedRevision}` : "Saved",
    rejected: "Rejected",
    conflict: "Conflict",
    discarded: "Discarded",
  };
  return labels[batch.status];
}

interface BatchCardProps {
  batch: AiOpBatch;
  targetName?: string | null;
  canApply: boolean;
  onPreview: (batch: AiOpBatch) => void;
  onReject: (batch: AiOpBatch) => Promise<void>;
  onOpen: (batch: AiOpBatch) => void;
}

export function BatchCard({
  batch,
  targetName,
  canApply,
  onPreview,
  onReject,
  onOpen,
}: BatchCardProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changesId = useId();
  const kindLabel = batch.targetKind === "data_model" ? "Data model" : "Flow";
  const { added, changed, removed } = batch.summary;
  const [showChanges, setShowChanges] = useState(false);
  const lines = useMemo(
    () => (showChanges ? describeOpBatch(batch, null) : []),
    [batch, showChanges],
  );
  const actionable = batch.status === "proposed" || batch.status === "conflict";

  const reject = async () => {
    setBusy(true);
    setError(null);
    try {
      await onReject(batch);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Could not reject");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`wpn-ai-card wpn-ai-batch wpn-ai-batch--${batch.status}`}>
      <header className="wpn-ai-card__head">
        <Icon name={batch.targetKind === "data_model" ? "dataModel" : "flow"} />
        <span className="wpn-ai-card__title">{batch.title || "Proposed changes"}</span>
        <span className={`wpn-ai-chip wpn-ai-chip--${batch.status}`}>
          {batchStatusLabel(batch)}
        </span>
      </header>
      <p className="wpn-ai-card__sub">
        {kindLabel}
        {targetName ? ` · ${targetName}` : ""} ·{" "}
        <span className="wpn-ai-batch__added">+{added}</span>{" "}
        <span className="wpn-ai-batch__changed">~{changed}</span>{" "}
        <span className="wpn-ai-batch__removed">−{removed}</span>
      </p>
      {batch.ops.length > 0 ? (
        <>
          <button
            type="button"
            className="wpn-ai-link wpn-ai-batch__toggle"
            aria-expanded={showChanges}
            aria-controls={changesId}
            onClick={() => setShowChanges((open) => !open)}
          >
            {showChanges ? "Hide changes" : "Show changes"}
          </button>
          <ul id={changesId} className="wpn-ai-batch__changes" hidden={!showChanges}>
            {lines.map((line, index) => (
              <li key={`${line.kind}-${line.subject}-${index}`} className="wpn-ai-batch__change">
                <span
                  className={`wpn-ai-batch__mark wpn-ai-batch__mark--${line.kind}`}
                  aria-hidden="true"
                >
                  {CHANGE_MARKS[line.kind]}
                </span>
                <span className="wpn-sr-only">
                  {line.kind === "add" ? "Add" : line.kind === "remove" ? "Remove" : "Change"}
                </span>
                <span>{line.subject}</span>
                {line.detail ? <span className="wpn-ai-muted">{line.detail}</span> : null}
                {line.before !== undefined && line.after !== undefined ? (
                  <span className="wpn-ai-muted">
                    {line.before} → {line.after}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {batch.rationale ? <p className="wpn-ai-card__body">{batch.rationale}</p> : null}
      {batch.status === "conflict" && batch.statusDetail ? (
        <p className="wpn-ai-card__warn">{batch.statusDetail}</p>
      ) : null}
      {error ? (
        <p className="wpn-ai-card__warn" role="alert">
          {error}
        </p>
      ) : null}
      <div className="wpn-ai-card__actions">
        {actionable ? (
          <button
            type="button"
            className="wpn-btn wpn-btn--primary"
            disabled={!canApply}
            title={canApply ? undefined : "Your role cannot edit this document"}
            onClick={() => onPreview(batch)}
          >
            <Icon name="eye" className="wpn-btn__icon" />
            {batch.status === "conflict" ? "Try again" : "Preview"}
          </button>
        ) : null}
        {batch.status === "proposed" ? (
          <button
            type="button"
            className="wpn-btn wpn-btn--ghost"
            disabled={busy}
            onClick={() => void reject()}
          >
            {busy ? <Spinner /> : null}
            Reject
          </button>
        ) : null}
        <button type="button" className="wpn-btn wpn-btn--ghost" onClick={() => onOpen(batch)}>
          <Icon name="open" className="wpn-btn__icon" />
          Open in editor
        </button>
      </div>
    </article>
  );
}

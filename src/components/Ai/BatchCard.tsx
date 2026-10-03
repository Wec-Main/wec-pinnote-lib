import { useMemo, useState } from "react";
import type { AiOpBatch, AiOpBatchStatus } from "../../types/ai.types";
import { Icon, Spinner } from "../primitives";
import { filterBatchOps, isBusyOpBatchStatus } from "../../ai/opBatchApplier";
import { AiChangeList } from "./AiChangeList";
import { describeOpBatch } from "./aiOpChanges";

export function batchStatusLabel(batch: Pick<AiOpBatch, "status" | "savedRevision">): string {
  const labels: Record<AiOpBatchStatus, string> = {
    applying: "Applying…",
    proposed: "Proposed",
    applied: "Applied (unsaved)",
    saved: batch.savedRevision !== null ? `Saved rev ${batch.savedRevision}` : "Saved",
    rejected: "Rejected",
    conflict: "Conflict",
    discarded: "Discarded",
  };
  return labels[batch.status] ?? String(batch.status);
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
  const kindLabel = batch.targetKind === "data_model" ? "Data model" : "Flow";
  const { added, changed, removed } = batch.summary;
  const [excluded, setExcluded] = useState<ReadonlySet<number>>(new Set());
  const lines = useMemo(() => describeOpBatch(batch, null), [batch]);
  const applyingElsewhere = isBusyOpBatchStatus(batch.status);
  const actionable =
    batch.status === "proposed" || batch.status === "conflict" || applyingElsewhere;

  const toggle = (opIndex: number) =>
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(opIndex)) next.delete(opIndex);
      else next.add(opIndex);
      return next;
    });

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
        <AiChangeList
          lines={lines}
          excluded={excluded}
          onToggle={actionable && canApply ? toggle : undefined}
        />
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
            disabled={!canApply || applyingElsewhere}
            title={canApply ? undefined : "Your role cannot edit this document"}
            onClick={() => onPreview(excluded.size > 0 ? filterBatchOps(batch, excluded) : batch)}
          >
            <Icon name="eye" className="wpn-btn__icon" />
            {applyingElsewhere
              ? "Applying…"
              : batch.status === "conflict"
                ? "Try again"
                : "Preview"}
          </button>
        ) : null}
        {batch.status === "proposed" ? (
          <button
            type="button"
            className="wpn-btn wpn-btn--ghost"
            disabled={busy}
            onClick={() => void reject()}
          >
            {busy ? <Spinner /> : <Icon name="x" className="wpn-btn__icon" />}
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

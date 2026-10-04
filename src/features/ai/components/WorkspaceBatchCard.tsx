import { useState } from "react";
import type { WorkspaceApplyItem } from "../ops/workspaceOps";
import { useAnnotationUi } from "../../../context/AnnotationContext";
import { WorkspaceProposal, type Phase } from "./AiWorkspaceProposal";
import {
  summarizeWorkspaceResult,
  useAiWorkspaceApplier,
  type AiWorkspaceBatch,
} from "./useAiWorkspaceApplier";

function initialPhase(batch: AiWorkspaceBatch): Phase {
  switch (batch.status) {
    case "applied":
    case "saved":
      return "applied";
    case "rejected":
    case "discarded":
      return "discarded";
    case "conflict":
      return "failed";
    default:
      return "idle";
  }
}

export function WorkspaceBatchCard({
  batch,
  canApply,
}: {
  batch: AiWorkspaceBatch;
  canApply: boolean;
}) {
  const applier = useAiWorkspaceApplier();
  const annotationUi = useAnnotationUi();
  const [phase, setPhase] = useState<Phase>(() => initialPhase(batch));
  const [items, setItems] = useState<WorkspaceApplyItem[]>([]);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const current: Phase = phase === "idle" ? initialPhase(batch) : phase;

  const approve = async () => {
    setPhase("applying");
    setError(null);
    setSummary("");
    setItems([]);
    try {
      const result = await applier.apply(batch, (next) => setItems(next.slice()));
      setItems(result.items);
      setSummary(summarizeWorkspaceResult(result));
      setPhase(result.done === 0 ? "failed" : result.failed > 0 ? "partial" : "applied");
      if (result.done === 0) setError(result.items[0]?.error ?? "Nothing could be created");
      else if (result.failed > 0) {
        setError(
          `${result.failed} ${result.failed === 1 ? "change was" : "changes were"} skipped.`,
        );
      }
      if (result.syncWarning)
        setError((current) => [current, result.syncWarning].filter(Boolean).join(" "));
    } catch (err) {
      setPhase("failed");
      setError(err instanceof Error && err.message ? err.message : "Something went wrong");
    }
  };

  const discard = async () => {
    setPhase("discarded");
    try {
      await applier.discard(batch);
    } catch {
      setPhase("idle");
      setError("Couldn't discard this proposal. Try again.");
    }
  };

  return (
    <WorkspaceProposal
      batch={batch}
      entry={{ phase: current, items, summary, error }}
      canApply={canApply}
      onApprove={() => void approve()}
      onDiscard={() => void discard()}
      onOpen={(item) => {
        if (!item.id) return;
        const kind =
          item.kind === "flow" ? "flow" : item.kind === "data_model" ? "dataModel" : "epic";
        annotationUi.openReference({ kind, id: item.id });
      }}
    />
  );
}

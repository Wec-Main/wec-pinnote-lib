import type { DocumentSaveState } from "../../hooks/useRevisionedDocument";
import { Spinner } from "./Spinner";

const SAVE_LABELS: Record<Exclude<DocumentSaveState, "idle">, string> = {
  pending: "Unsaved changes",
  saving: "Saving…",
  saved: "All changes saved",
  error: "Not saved",
};

export function SaveIndicator({
  state,
  savedCount,
}: {
  state: DocumentSaveState;
  savedCount: number;
}) {
  if (state === "idle") {
    return null;
  }
  return (
    <span
      key={state === "saved" ? `saved-${savedCount}` : state}
      className={`wpn-flow-save wpn-flow-save--${state}`}
      role="status"
      aria-live="polite"
    >
      {state === "saving" ? (
        <Spinner />
      ) : (
        <span className="wpn-flow-save__dot" aria-hidden="true" />
      )}
      {SAVE_LABELS[state]}
    </span>
  );
}

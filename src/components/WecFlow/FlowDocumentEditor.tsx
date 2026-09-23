import type { ReactNode } from "react";
import { FlowEditor } from "./flowchart";
import { FlowCanvasSkeleton } from "./FlowCanvasSkeleton";
import { Icon, Spinner } from "../primitives";
import type { FlowDocumentState, FlowSaveState } from "../../hooks/useFlowDocument";

interface FlowDocumentEditorProps {
  flowDocument: FlowDocumentState;
  signedIn: boolean;
  resolveError?: string | null;
  onRetry?: () => void;
}

const SAVE_LABELS: Record<Exclude<FlowSaveState, "idle">, string> = {
  pending: "Unsaved changes",
  saving: "Saving…",
  saved: "All changes saved",
  error: "Not saved",
};

function SaveIndicator({ state, savedCount }: { state: FlowSaveState; savedCount: number }) {
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

interface FlowMessageProps {
  icon: "alert" | "flow";
  message: string;
  action?: ReactNode;
}

function FlowMessage({ icon, message, action }: FlowMessageProps) {
  return (
    <div className="wpn-flow-message" role={icon === "alert" ? "alert" : undefined}>
      <span className={`wpn-flow-message__icon wpn-flow-message__icon--${icon}`}>
        <Icon name={icon} />
      </span>
      <p className="wpn-flow-message__text">{message}</p>
      {action}
    </div>
  );
}

export function FlowDocumentEditor({
  flowDocument,
  signedIn,
  resolveError,
  onRetry,
}: FlowDocumentEditorProps) {
  const {
    status,
    document,
    loadKey,
    error,
    saveError,
    saveState,
    savedCount,
    scheduleSave,
    save,
    publish,
    reload,
  } = flowDocument;

  if (!signedIn) {
    return <FlowMessage icon="flow" message="Sign in to open this flow." />;
  }

  const loadError = resolveError ?? (status === "error" ? error : null);
  if (loadError) {
    return (
      <FlowMessage
        icon="alert"
        message={loadError}
        action={
          <button type="button" className="wpn-btn wpn-btn--ghost" onClick={onRetry ?? reload}>
            <Icon name="refresh" />
            Retry
          </button>
        }
      />
    );
  }

  if (status === "loading" || !document) {
    return <FlowCanvasSkeleton />;
  }

  return (
    <div className="wpn-flow-stage">
      {saveError ? (
        <div className="wpn-flow-panel__notice" role="alert">
          <span>{saveError}</span>
          <button type="button" className="wpn-btn wpn-btn--ghost" onClick={reload}>
            Reload
          </button>
        </div>
      ) : null}
      <div key={loadKey} className="wpn-flow-stage__editor">
        <FlowEditor
          initialFlow={document}
          defaultEdgeType="step"
          onChange={scheduleSave}
          onSave={save}
          onPublish={publish}
          brand={<></>}
        />
        <SaveIndicator state={saveState} savedCount={savedCount} />
      </div>
    </div>
  );
}

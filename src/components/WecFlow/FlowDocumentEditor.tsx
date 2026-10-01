import { FlowEditor } from "./FlowEditor";
import { FlowCanvasSkeleton } from "./FlowCanvasSkeleton";
import { Icon, SaveIndicator, StageMessage } from "../primitives";
import type { FlowDocumentState } from "../../hooks/useFlowDocument";

interface FlowDocumentEditorProps {
  flowDocument: FlowDocumentState;
  signedIn: boolean;
  resolveError?: string | null;
  onRetry?: () => void;
  onDelete?: () => void;
}

export function FlowDocumentEditor({
  flowDocument,
  signedIn,
  resolveError,
  onRetry,
  onDelete,
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
    return <StageMessage icon="flow" message="Sign in to open this flow." />;
  }

  const loadError = resolveError ?? (status === "error" ? error : null);
  if (loadError) {
    return (
      <StageMessage
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
          onDelete={onDelete}
          brand={<></>}
        />
        <SaveIndicator state={saveState} savedCount={savedCount} />
      </div>
    </div>
  );
}

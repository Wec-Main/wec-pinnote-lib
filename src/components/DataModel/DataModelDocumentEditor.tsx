import { Icon, SaveIndicator, StageMessage } from "../primitives";
import type { DataModelDocumentState } from "../../hooks/useDataModelDocument";
import type { ErdEngineName } from "../../types/dataModel.types";
import { ErdEditor } from "./erd/ErdEditor";

const SKELETON_ENTITIES = [
  { left: "12%", top: "14%", rows: 4 },
  { left: "46%", top: "10%", rows: 5 },
  { left: "30%", top: "58%", rows: 3 },
  { left: "68%", top: "52%", rows: 4 },
];

function DataModelCanvasSkeleton() {
  return (
    <div className="wpn-datamodel-skeleton" aria-busy="true" role="status">
      <div className="wpn-datamodel-skeleton__toolbar">
        <span className="wpn-datamodel-skeleton__bar wpn-datamodel-skeleton__bar--title" />
        <span className="wpn-datamodel-skeleton__bar wpn-datamodel-skeleton__bar--tools" />
        <span className="wpn-datamodel-skeleton__bar wpn-datamodel-skeleton__bar--action" />
      </div>
      <div className="wpn-datamodel-skeleton__canvas">
        {SKELETON_ENTITIES.map((entity, index) => (
          <div
            key={index}
            className="wpn-datamodel-skeleton__entity"
            style={{ left: entity.left, top: entity.top, animationDelay: `${index * 110}ms` }}
          >
            <span className="wpn-datamodel-skeleton__header" />
            {Array.from({ length: entity.rows }, (_, row) => (
              <span key={row} className="wpn-datamodel-skeleton__row" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface DataModelDocumentEditorProps {
  dataModelDocument: DataModelDocumentState;
  name: string;
  signedIn: boolean;
  resolveError?: string | null;
  onRetry?: () => void;
  description?: string;
  onMetaChange?: (patch: { name?: string; description?: string; engine?: ErdEngineName }) => void;
}

export function DataModelDocumentEditor({
  dataModelDocument,
  name,
  signedIn,
  resolveError,
  onRetry,
  description,
  onMetaChange,
}: DataModelDocumentEditorProps) {
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
  } = dataModelDocument;

  if (!signedIn) {
    return <StageMessage icon="dataModel" message="Sign in to open this data model." />;
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
    return <DataModelCanvasSkeleton />;
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
        <ErdEditor
          initialDocument={document}
          name={name}
          onChange={scheduleSave}
          onSave={save}
          onPublish={publish}
          description={description}
          onMetaChange={onMetaChange}
          saveIndicator={<SaveIndicator state={saveState} savedCount={savedCount} />}
        />
      </div>
    </div>
  );
}

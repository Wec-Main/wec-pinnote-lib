import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon, SaveIndicator, StageMessage } from "../primitives";
import { useAiDockControl } from "../../ai/aiDockState";
import { useAiOpBatchApplier } from "../../ai/useAiOpBatchApplier";
import type { DataModelDocumentState } from "../../hooks/useDataModelDocument";
import { useVersionHistory } from "../../hooks/useVersionHistory";
import { fetchDataModelVersion, listDataModelVersions } from "../../services/dataModelApi";
import type {
  DataModelVersionRecord,
  ErdDocumentJSON,
  ErdEngineName,
} from "../../types/dataModel.types";
import { parseErdDocument } from "../../utils/erd/erdSerialization";
import type { ErdEngine } from "../../utils/erd/erdEngine";
import { AiPreviewScopeContext, type AiPreviewScopeValue } from "../Ai/AiPreviewScope";
import { AiUnsavedChanges, AskAiButton, ErdAiBar, ErdEngineReporter } from "../Ai/ErdAiIntegration";
import { AiWorkRow } from "../Ai/AiWorkStatus";
import {
  VersionPreviewBanner,
  VersionPreviewError,
  VersionsButton,
  VersionsPanel,
} from "../Versions/VersionsPanel";
import { useDataModelLeaveGuard } from "./DataModelLeaveGuard";
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

async function fetchDataModelVersionDocument(
  apiBaseUrl: string,
  authToken: string | undefined,
  dataModelId: string,
  version: DataModelVersionRecord,
): Promise<ErdDocumentJSON | undefined> {
  const detail = await fetchDataModelVersion(apiBaseUrl, authToken, dataModelId, version.version);
  return detail.document ? parseErdDocument(detail.document) : undefined;
}

interface DataModelDocumentEditorProps {
  dataModelDocument: DataModelDocumentState;
  dataModelId?: string;
  onUnsavedAiChangesChange?: (hasUnsavedAiChanges: boolean) => void;
  name: string;
  signedIn: boolean;
  resolveError?: string | null;
  onRetry?: () => void;
  description?: string;
  onMetaChange?: (patch: { name?: string; description?: string; engine?: ErdEngineName }) => void;
}

export function DataModelDocumentEditor({
  dataModelDocument,
  dataModelId,
  onUnsavedAiChangesChange,
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

  const [engine, setEngine] = useState<ErdEngine | null>(null);
  const aiDock = useAiDockControl();
  const [aiSaving, setAiSaving] = useState(false);
  const applier = useAiOpBatchApplier({
    kind: "data_model",
    targetId: dataModelId ?? null,
    engine,
    documentState: dataModelDocument,
    onUnsavedAiChangesChange,
    onModelDescription: (description) => onMetaChange?.({ description }),
    onModelName: (modelName) => onMetaChange?.({ name: modelName }),
  });
  const { hasUnsavedAiChanges } = applier;
  const leaveGuard = useDataModelLeaveGuard();
  const discardRef = useRef(applier.discard);
  discardRef.current = applier.discard;
  useEffect(() => {
    leaveGuard?.setUnsavedAiDiscard(hasUnsavedAiChanges ? () => discardRef.current() : null);
    if (!hasUnsavedAiChanges) {
      return undefined;
    }
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedAiChanges, leaveGuard]);
  useEffect(() => () => leaveGuard?.setUnsavedAiDiscard(null), [leaveGuard]);
  const saveAiChanges = useCallback(() => {
    if (!engine) return;
    setAiSaving(true);
    save(engine.toJSON())
      .catch(() => undefined)
      .finally(() => setAiSaving(false));
  }, [engine, save]);
  const {
    versionsOpen,
    versions,
    versionsLoading,
    versionsError,
    hasVersions,
    previewVersion,
    previewDocument,
    previewLoading,
    previewError,
    toggleVersions,
    closeVersions,
    previewVersionRecord,
    exitPreview,
    dismissPreviewError,
    markPublished,
  } = useVersionHistory<DataModelVersionRecord, ErdDocumentJSON>({
    documentId: dataModelId ?? null,
    listVersions: listDataModelVersions,
    fetchVersionDocument: fetchDataModelVersionDocument,
  });
  const handlePublish = useCallback(
    async (dataModel: ErdDocumentJSON) => {
      await publish(dataModel);
      markPublished();
    },
    [publish, markPublished],
  );
  const snapshotForAi = useCallback(async () => {
    if (!engine) return;
    await handlePublish(engine.toJSON());
  }, [engine, handlePublish]);
  const previewScope = useMemo<AiPreviewScopeValue | null>(
    () => (dataModelId ? { kind: "data_model", id: dataModelId } : null),
    [dataModelId],
  );

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

  const versionsButton = dataModelId ? (
    <VersionsButton
      open={versionsOpen}
      hasVersions={hasVersions}
      onToggle={() => void toggleVersions()}
    />
  ) : null;

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
      {previewVersion ? (
        <VersionPreviewBanner version={previewVersion} onExit={exitPreview} />
      ) : null}
      {previewError ? (
        <VersionPreviewError message={previewError} onDismiss={dismissPreviewError} />
      ) : null}
      <AiWorkRow control={aiDock} />
      <div className="wpn-flow-stage__main">
        {previewVersion && previewDocument ? (
          <div key={`preview-${previewVersion.id}`} className="wpn-flow-stage__editor">
            <ErdEditor
              initialDocument={previewDocument}
              name={name}
              readOnly={true}
              description={description}
              toolbarActions={versionsButton}
            />
          </div>
        ) : (
          <div key={loadKey} className="wpn-flow-stage__editor">
            <AiPreviewScopeContext.Provider value={previewScope}>
              <ErdEditor
                initialDocument={document}
                name={name}
                onChange={scheduleSave}
                onSave={save}
                onPublish={handlePublish}
                description={description}
                onMetaChange={onMetaChange}
                saveIndicator={<SaveIndicator state={saveState} savedCount={savedCount} />}
                onAskAi={dataModelId ? aiDock.show : undefined}
                toolbarActions={
                  dataModelId ? (
                    <>
                      {versionsButton}
                      <AiUnsavedChanges
                        applier={applier}
                        onSave={saveAiChanges}
                        saving={aiSaving}
                      />
                    <AskAiButton control={aiDock} />
                    </>
                  ) : null
                }
                overlay={
                  dataModelId ? (
                    <>
                      <ErdEngineReporter onEngine={setEngine} />
                      {engine ? (
                        <ErdAiBar
                          dataModelId={dataModelId}
                          applier={applier}
                          control={aiDock}
                          onSnapshot={snapshotForAi}
                        />
                      ) : null}
                    </>
                  ) : null
                }
              />
            </AiPreviewScopeContext.Provider>
          </div>
        )}
        {versionsOpen ? (
          <VersionsPanel
            versions={versions}
            loading={versionsLoading}
            error={versionsError}
            previewVersionId={previewVersion?.id ?? null}
            previewLoading={previewLoading}
            onPreview={previewVersionRecord}
            onExitPreview={exitPreview}
            onClose={closeVersions}
          />
        ) : null}
      </div>
    </div>
  );
}

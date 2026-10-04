import { useCallback, useEffect, useMemo, useState } from "react";
import { useAiDockControl } from "../../ai/aiDockState";
import { useAnnotationUi, type FlowEditorSource } from "../../../context/AnnotationContext";
import { ConfirmDialog } from "../../userManagement/components/ConfirmDialog";
import { FlowEditor } from "./FlowEditor";
import { FlowCanvasSkeleton } from "./FlowCanvasSkeleton";
import {
  VersionPreviewBanner,
  VersionPreviewError,
  VersionsButton,
  VersionsPanel,
} from "../../../components/Versions/VersionsPanel";
import { SaveIndicator } from "../../../components/primitives/SaveIndicator";
import { StageMessage } from "../../../components/primitives/StageMessage";
import { listFlowVersions, fetchFlowVersionDocument } from "../../../services/flowchartService";
import { useVersionHistory } from "../../../hooks/useVersionHistory";
import type { FlowDocumentState } from "../../../hooks/useFlowDocument";
import type { FlowVersionRecord } from "../../../types/flowPin.types";
import type { FlowJSON } from "../../../types/flowchart.types";
import { useAiOpBatchApplier } from "../../ai/useAiOpBatchApplier";
import type { FlowEngine } from "../../../utils/flowchart/flowEngine";
import {
  AiPreviewScopeContext,
  type AiPreviewScopeValue,
} from "../../ai/components/AiPreviewScope";
import { AiUnsavedChanges, AskAiButton } from "../../ai/components/ErdAiIntegration";
import { AiWorkRow } from "../../ai/components/AiWorkStatus";
import { FlowAiBar, FlowEngineReporter } from "../../ai/components/FlowAiIntegration";

async function fetchFlowVersion(
  apiBaseUrl: string,
  authToken: string | undefined,
  flowId: string,
  version: FlowVersionRecord,
): Promise<FlowJSON | undefined> {
  const result = await fetchFlowVersionDocument(apiBaseUrl, authToken, flowId, version.id);
  return result.document;
}

interface FlowDocumentEditorProps {
  flowDocument: FlowDocumentState;
  flowId: string;
  source: FlowEditorSource;
  signedIn: boolean;
  resolveError?: string | null;
  onRetry?: () => void;
  onDelete?: () => void;
}

export function FlowDocumentEditor({
  flowDocument,
  flowId,
  source,
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
    hasUnsavedChanges,
    scheduleSave,
    save,
    publish,
    reload,
  } = flowDocument;
  const { setFlowDirty, flowLeaveRequest, resolveFlowLeave } = useAnnotationUi();

  const [aiEngine, setAiEngine] = useState<FlowEngine | null>(null);
  const aiDock = useAiDockControl();
  const aiApplier = useAiOpBatchApplier({
    kind: "flow",
    targetId: flowId,
    engine: aiEngine,
    documentState: flowDocument,
  });
  const aiPreviewScope = useMemo<AiPreviewScopeValue>(
    () => ({ kind: "flow", id: flowId }),
    [flowId],
  );

  const {
    versionsOpen,
    versions,
    versionsLoading,
    versionsError,
    hasVersions,
    previewVersion,
    previewDocument: previewDoc,
    previewLoading,
    previewError,
    toggleVersions,
    closeVersions,
    previewVersionRecord,
    exitPreview,
    dismissPreviewError,
    markPublished,
  } = useVersionHistory<FlowVersionRecord, FlowJSON>({
    documentId: flowId,
    listVersions: listFlowVersions,
    fetchVersionDocument: fetchFlowVersion,
  });

  const handlePublish: typeof publish = useCallback(
    async (flow) => {
      await publish(flow);
      markPublished();
    },
    [publish, markPublished],
  );

  const snapshotForAi = useCallback(async () => {
    if (!aiEngine) return;
    await handlePublish(aiEngine.toJSON());
  }, [aiEngine, handlePublish]);

  useEffect(() => {
    setFlowDirty(source, hasUnsavedChanges);
    if (!hasUnsavedChanges) {
      return;
    }
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges, setFlowDirty, source]);

  useEffect(() => () => setFlowDirty(source, false), [setFlowDirty, source]);

  const leaveDialog =
    flowLeaveRequest === source ? (
      <ConfirmDialog
        title="This flow is not saved"
        description="You have unsaved changes. If you leave now, you will lose them."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        destructive
        onCancel={() => resolveFlowLeave(false)}
        onConfirm={() => resolveFlowLeave(true)}
      />
    ) : null;

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
            Retry
          </button>
        }
      />
    );
  }

  if (status === "loading" || !document) {
    return <FlowCanvasSkeleton />;
  }

  const versionsButton = (
    <VersionsButton
      open={versionsOpen}
      hasVersions={hasVersions}
      onToggle={() => void toggleVersions()}
    />
  );

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
        {previewVersion && previewDoc ? (
          <div key={`preview-${previewVersion.id}`} className="wpn-flow-stage__editor">
            <FlowEditor
              initialFlow={previewDoc}
              readOnly={true}
              showProperties={false}
              brand={<></>}
              toolbarActions={versionsButton}
            />
          </div>
        ) : (
          <div key={loadKey} className="wpn-flow-stage__editor">
            <AiPreviewScopeContext.Provider value={aiPreviewScope}>
              <FlowEditor
                initialFlow={document}
                defaultEdgeType="step"
                onChange={scheduleSave}
                onSave={save}
                onPublish={handlePublish}
                onDelete={onDelete}
                brand={<></>}
                toolbarActions={
                  <>
                    {versionsButton}
                    <FlowEngineReporter onEngine={setAiEngine} />
                    <AiUnsavedChanges
                      applier={aiApplier}
                      onSave={() => {
                        if (aiEngine) void save(aiEngine.toJSON()).catch(() => undefined);
                      }}
                    />
                    <AskAiButton control={aiDock} />
                  </>
                }
                overlay={
                  aiEngine ? (
                    <FlowAiBar
                      flowId={flowId}
                      engine={aiEngine}
                      applier={aiApplier}
                      control={aiDock}
                      onSnapshot={snapshotForAi}
                    />
                  ) : null
                }
              />
            </AiPreviewScopeContext.Provider>
            <SaveIndicator state={saveState} savedCount={savedCount} />
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
      {leaveDialog}
    </div>
  );
}

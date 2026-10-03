import { memo, useCallback, useEffect, useState, type CSSProperties } from "react";
import type { AiDockControl } from "../../ai/aiDockState";
import { useAiPreview } from "../../ai/aiPreviewStore";
import { aiSelectionLabel, usePublishAiSelection } from "../../ai/aiSelectionStore";
import type { AiOpBatchApplier } from "../../ai/useAiOpBatchApplier";
import { useErdEngine, useErdState } from "../../context/ErdContext";
import { ENTITY_DEFAULT_WIDTH } from "../../utils/erd/erdConstants";
import { entityHeight } from "../../utils/erd/erdGeometry";
import type { ErdEngine } from "../../utils/erd/erdEngine";
import { Icon, Spinner } from "../primitives";
import { ConfirmDialog } from "../UserManagement/ConfirmDialog";
import { AiEditorDock } from "./AiEditorDock";
import { useAiMentionCandidates } from "./useAiMentionCandidates";
import { useAiPreviewScope } from "./AiPreviewScope";
import { useAiAvailable } from "./IntegrationsButton";

export function ErdEngineReporter({ onEngine }: { onEngine: (engine: ErdEngine | null) => void }) {
  const engine = useErdEngine();
  useEffect(() => {
    onEngine(engine);
    return () => onEngine(null);
  }, [engine, onEngine]);
  return null;
}

const ENTITY_NOUN = ["entity", "entities"] as const;

export function ErdAiBar({
  dataModelId,
  applier,
  control,
  onSnapshot,
}: {
  dataModelId: string;
  applier: AiOpBatchApplier;
  control: AiDockControl;
  onSnapshot?: () => Promise<void>;
}) {
  const engine = useErdEngine();
  const selectedIds = useErdState((s) => s.selection.entityIds);
  const selectedCount = selectedIds.size;
  const readOnly = useErdState((s) => s.readOnly);
  const isEmpty = useErdState((s) => s.entities.length === 0);
  const getSelectedIds = useCallback(() => [...engine.getState().selection.entityIds], [engine]);
  const getDocument = useCallback(() => engine.toJSON(), [engine]);
  const selectionLabel = useCallback(
    (ids: string[]) => {
      const byId = new Map(engine.getState().entities.map((entity) => [entity.id, entity.name]));
      return aiSelectionLabel(
        ids.map((id) => byId.get(id) ?? ""),
        ENTITY_NOUN,
      );
    },
    [engine],
  );
  usePublishAiSelection("data_model", dataModelId, selectedIds, selectionLabel);
  const subscribeChanges = useCallback(
    (listener: () => void) => engine.on("change", listener),
    [engine],
  );
  const mentionSource = useAiMentionCandidates();
  return (
    <AiEditorDock
      kind="data_model"
      targetId={dataModelId}
      applier={applier}
      getSelectedIds={getSelectedIds}
      selectedCount={selectedCount}
      itemNoun={ENTITY_NOUN}
      wholeLabel="Whole model"
      isEmpty={isEmpty}
      getDocument={getDocument}
      subscribeChanges={subscribeChanges}
      editable={!readOnly || applier.locked}
      control={control}
      onSnapshot={onSnapshot}
      mentionSource={mentionSource}
    />
  );
}

export const ErdAiGhosts = memo(function ErdAiGhosts() {
  const scope = useAiPreviewScope();
  const overlay = useAiPreview("data_model", scope?.kind === "data_model" ? scope.id : null);
  if (!overlay || overlay.ghosts.entities.length === 0) return null;
  return (
    <>
      {overlay.ghosts.entities.map((entity) => (
        <div
          key={`ghost-${entity.id}`}
          className="wpn-erd-entity wpn-ai-removed wpn-ai-ghost"
          aria-hidden="true"
          style={
            {
              left: entity.position.x,
              top: entity.position.y,
              width: entity.width ?? ENTITY_DEFAULT_WIDTH,
              height: entityHeight(entity),
            } as CSSProperties
          }
        >
          <div className="wpn-erd-entity__header">
            <span className="wpn-erd-entity__name">{entity.name}</span>
          </div>
          {!entity.collapsed ? (
            <div className="wpn-erd-entity__body">
              {entity.fields.map((field) => (
                <div key={field.id} className="wpn-erd-field">
                  <span className="wpn-erd-field__keys" />
                  <span className="wpn-erd-field__name">{field.name}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </>
  );
});

export function AiUnsavedChanges({
  applier,
  onSave,
  saving = false,
}: {
  applier: AiOpBatchApplier;
  onSave: () => void;
  saving?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  if (!applier.hasUnsavedAiChanges) return null;
  const confirmDiscard = () => {
    setDiscarding(true);
    void applier.discard().finally(() => {
      setDiscarding(false);
      setConfirming(false);
    });
  };
  return (
    <span className="wpn-ai-unsaved" role="status">
      <Icon name="sparkles" className="wpn-ai-unsaved__icon" />
      Unsaved AI changes
      <button type="button" className="wpn-ai-unsaved__btn" disabled={saving} onClick={onSave}>
        {saving ? <Spinner /> : null}
        Save
      </button>
      <button
        type="button"
        className="wpn-ai-unsaved__btn wpn-ai-unsaved__btn--ghost"
        disabled={saving || discarding}
        onClick={() => setConfirming(true)}
      >
        Discard
      </button>
      {confirming ? (
        <ConfirmDialog
          title="Discard AI changes?"
          description="The unsaved AI changes will be removed and the document reloaded from the last saved version. This cannot be undone."
          confirmLabel="Discard changes"
          destructive
          busy={discarding}
          onCancel={() => setConfirming(false)}
          onConfirm={confirmDiscard}
        />
      ) : null}
    </span>
  );
}

export function AskAiButton({
  control,
  onClick,
}: {
  control: AiDockControl;
  onClick?: () => void;
}) {
  const available = useAiAvailable();
  if (!available) return null;
  const badgeLabel =
    control.badge === "running"
      ? "AI is working"
      : control.badge === "proposal"
        ? "AI has a proposal"
        : null;
  return (
    <button
      type="button"
      className={[
        "wpn-flowchart-ui__btn wpn-flowchart-ui__btn-ghost wpn-ai-ask-btn",
        control.open ? "wpn-ai-ask-btn--open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      title="Ask AI (⌘I)"
      aria-pressed={control.open}
      onClick={onClick ?? control.toggle}
    >
      <Icon name="sparkles" className="wpn-ai-ask-btn__icon" /> Ask AI
      {control.badge ? (
        <span
          className={`wpn-ai-ask-btn__dot wpn-ai-ask-btn__dot--${control.badge}`}
          role="img"
          aria-label={badgeLabel ?? undefined}
        />
      ) : null}
    </button>
  );
}

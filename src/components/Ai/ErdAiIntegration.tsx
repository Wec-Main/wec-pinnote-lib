import { memo, Suspense, useEffect, useState, type CSSProperties } from "react";
import type { AiDockControl } from "../../ai/aiDockState";
import { useAiPreview } from "../../ai/aiPreviewStore";
import type { AiOpBatchApplier } from "../../ai/useAiOpBatchApplier";
import { useErdEngine } from "../../context/ErdContext";
import { ENTITY_DEFAULT_WIDTH } from "../../utils/erd/erdConstants";
import { entityHeight } from "../../utils/erd/erdGeometry";
import type { ErdEngine } from "../../utils/erd/erdEngine";
import type { AiEditorTargetKind } from "../../types/ai.types";
import { Icon, Spinner } from "../primitives";
import { ConfirmDialog } from "../UserManagement/ConfirmDialog";
import {
  getLazyErdAiDockHost,
  prefetchAiDock,
  resetLazyAiDockHosts,
  useAiDockMounted,
  usePrefetchAiDockWhenIdle,
} from "./aiDockLoader";
import { AiDockBoundary } from "./AiDockBoundary";
import type { ErdAiBarProps } from "./ErdAiDockHost";
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

export type { ErdAiBarProps } from "./ErdAiDockHost";

export function ErdAiBar(props: ErdAiBarProps) {
  const available = useAiAvailable();
  usePrefetchAiDockWhenIdle(available, "data_model");
  const mounted = useAiDockMounted("data_model", props.dataModelId, props.control, available);
  if (!mounted) return null;
  const Host = getLazyErdAiDockHost();
  return (
    <AiDockBoundary onRetry={resetLazyAiDockHosts}>
      <Suspense fallback={null}>
        <Host {...props} />
      </Suspense>
    </AiDockBoundary>
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
        {saving ? <Spinner /> : <Icon name="save" className="wpn-btn__icon" />}
        Save
      </button>
      <button
        type="button"
        className="wpn-ai-unsaved__btn wpn-ai-unsaved__btn--ghost"
        disabled={saving || discarding}
        onClick={() => setConfirming(true)}
      >
        <Icon name="x" className="wpn-btn__icon" />
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
  kind,
}: {
  control: AiDockControl;
  onClick?: () => void;
  kind?: AiEditorTargetKind;
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
      onPointerEnter={() => prefetchAiDock(kind)}
      onFocus={() => prefetchAiDock(kind)}
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

import { useCallback } from "react";
import type { AiDockControl } from "../aiDockState";
import { aiSelectionLabel, usePublishAiSelection } from "../aiSelectionStore";
import type { AiOpBatchApplier } from "../useAiOpBatchApplier";
import { useErdEngine, useErdState } from "../../erd/ErdContext";
import { AiEditorDock } from "./AiEditorDock";
import { useAiMentionCandidates } from "./useAiMentionCandidates";

export interface ErdAiBarProps {
  dataModelId: string;
  applier: AiOpBatchApplier;
  control: AiDockControl;
  onSnapshot?: () => Promise<void>;
}

const ENTITY_NOUN = ["entity", "entities"] as const;

export function ErdAiDockHost({ dataModelId, applier, control, onSnapshot }: ErdAiBarProps) {
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

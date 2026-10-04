import { useCallback } from "react";
import type { AiDockControl } from "../aiDockState";
import { aiSelectionLabel, usePublishAiSelection } from "../aiSelectionStore";
import type { AiOpBatchApplier } from "../useAiOpBatchApplier";
import { useStoreSelector } from "../../../hooks/useStoreSelector";
import type { FlowEngine } from "../../../utils/flowchart/flowEngine";
import { AiEditorDock } from "./AiEditorDock";
import { useAiMentionCandidates } from "./useAiMentionCandidates";

export interface FlowAiBarProps {
  flowId: string;
  engine: FlowEngine;
  applier: AiOpBatchApplier;
  control: AiDockControl;
  onSnapshot?: () => Promise<void>;
}

const NODE_NOUN = ["node", "nodes"] as const;

export function FlowAiDockHost({ flowId, engine, applier, control, onSnapshot }: FlowAiBarProps) {
  const selectedIds = useStoreSelector(engine.store, (s) => s.selectedNodeIds);
  const selectedCount = selectedIds.size;
  const readOnly = useStoreSelector(engine.store, (s) => s.readOnly);
  const isEmpty = useStoreSelector(engine.store, (s) => s.nodes.length === 0);
  const getSelectedIds = useCallback(() => [...engine.getState().selectedNodeIds], [engine]);
  const getDocument = useCallback(() => engine.toJSON(), [engine]);
  const selectionLabel = useCallback(
    (ids: string[]) => {
      const byId = new Map(
        engine.getState().nodes.map((node) => [node.id, (node.data?.label ?? "").trim()]),
      );
      return aiSelectionLabel(
        ids.map((id) => byId.get(id) ?? ""),
        NODE_NOUN,
      );
    },
    [engine],
  );
  usePublishAiSelection("flow", flowId, selectedIds, selectionLabel);
  const subscribeChanges = useCallback(
    (listener: () => void) => engine.on("change", listener),
    [engine],
  );
  const mentionSource = useAiMentionCandidates();
  return (
    <AiEditorDock
      kind="flow"
      targetId={flowId}
      applier={applier}
      getSelectedIds={getSelectedIds}
      selectedCount={selectedCount}
      itemNoun={NODE_NOUN}
      wholeLabel="Whole flow"
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

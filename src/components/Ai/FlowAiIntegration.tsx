import { useCallback, useEffect } from "react";
import type { AiDockControl } from "../../ai/aiDockState";
import { aiSelectionLabel, usePublishAiSelection } from "../../ai/aiSelectionStore";
import type { AiOpBatchApplier } from "../../ai/useAiOpBatchApplier";
import { useFlowEngine } from "../../context/FlowContext";
import { useStoreSelector } from "../../hooks/useStoreSelector";
import type { FlowEngine } from "../../utils/flowchart/flowEngine";
import { AiEditorDock } from "./AiEditorDock";
import { useAiMentionCandidates } from "./useAiMentionCandidates";

export function FlowEngineReporter({
  onEngine,
}: {
  onEngine: (engine: FlowEngine | null) => void;
}) {
  const engine = useFlowEngine();
  useEffect(() => {
    onEngine(engine);
    return () => onEngine(null);
  }, [engine, onEngine]);
  return null;
}

const NODE_NOUN = ["node", "nodes"] as const;

export function FlowAiBar({
  flowId,
  engine,
  applier,
  control,
  onSnapshot,
}: {
  flowId: string;
  engine: FlowEngine;
  applier: AiOpBatchApplier;
  control: AiDockControl;
  onSnapshot?: () => Promise<void>;
}) {
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

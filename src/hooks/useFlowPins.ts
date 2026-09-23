import { useCallback, useMemo, useState } from "react";
import type { AnnotationAnchor } from "../types/annotation.types";
import type { DraftFlowPin, FlowPin } from "../types/flowPin.types";
import type { FlowJSON } from "../components/WecFlow/flowchart";
import { createClientId } from "../utils/format";
import { isBoolean, usePersistentState } from "./usePersistentState";

interface UseFlowPinsOptions {
  projectId: string;
  pageKey: string;
}

export interface FlowPinsState {
  flowPins: FlowPin[];
  flowPinsVisible: boolean;
  setFlowPinsVisible: (visible: boolean) => void;
  flowPinModeEnabled: boolean;
  setFlowPinModeEnabled: (enabled: boolean) => void;
  flowPinDraft: DraftFlowPin | null;
  startFlowPinDraft: (anchor: AnnotationAnchor, label: string) => void;
  cancelFlowPinDraft: () => void;
  submitFlowPinDraft: (name: string) => void;
  removeFlowPin: (flowPinId: string) => void;
  updateFlowPinFlow: (flowPinId: string, flow: FlowJSON) => void;
  selectedFlowPinId: string | null;
  selectFlowPin: (id: string | null) => void;
}

function isFlowPinArray(value: unknown): value is FlowPin[] {
  return Array.isArray(value);
}

/** Flow pins are attached to page elements the same way tags are, but hold a
 * full flowchart per pin instead of a shared tag definition. Persisted per
 * project + page in the browser, matching WecFlowPanel's own storage until a
 * backend endpoint exists for them. */
export function useFlowPins(options: UseFlowPinsOptions): FlowPinsState {
  const { projectId, pageKey } = options;
  const storageKey = `wpn-ui:${projectId}:${pageKey}:flowPins`;
  const [allFlowPins, setAllFlowPins] = usePersistentState<FlowPin[]>(storageKey, [], isFlowPinArray);
  const [flowPinsVisible, setFlowPinsVisible] = usePersistentState(
    `wpn-ui:${projectId}:flowPinsVisible`,
    true,
    isBoolean,
  );
  const [flowPinModeEnabled, setFlowPinModeEnabledState] = useState(false);
  const [flowPinDraft, setFlowPinDraft] = useState<DraftFlowPin | null>(null);
  const [selectedFlowPinId, setSelectedFlowPinId] = useState<string | null>(null);

  const flowPins = useMemo(() => allFlowPins, [allFlowPins]);

  const setFlowPinModeEnabled = useCallback((enabled: boolean) => {
    setFlowPinModeEnabledState(enabled);
    if (!enabled) {
      setFlowPinDraft(null);
    }
  }, []);

  const startFlowPinDraft = useCallback((anchor: AnnotationAnchor, label: string) => {
    setFlowPinDraft({ id: createClientId("wpn-flow-pin-draft"), anchor, label });
  }, []);

  const cancelFlowPinDraft = useCallback(() => setFlowPinDraft(null), []);

  const submitFlowPinDraft = useCallback(
    (name: string) => {
      if (!flowPinDraft) {
        return;
      }
      const trimmed = name.trim() || flowPinDraft.label;
      const now = new Date().toISOString();
      const created: FlowPin = {
        id: createClientId("wpn-flow-pin"),
        projectId,
        pageKey,
        name: trimmed,
        anchor: flowPinDraft.anchor,
        flow: { version: 1, nodes: [], edges: [], meta: { name: trimmed } },
        createdAt: now,
        updatedAt: now,
      };
      setAllFlowPins([created, ...allFlowPins]);
      setFlowPinDraft(null);
      setFlowPinModeEnabledState(false);
      setSelectedFlowPinId(created.id);
    },
    [allFlowPins, flowPinDraft, pageKey, projectId, setAllFlowPins],
  );

  const removeFlowPin = useCallback(
    (flowPinId: string) => {
      setAllFlowPins(allFlowPins.filter((item) => item.id !== flowPinId));
      setSelectedFlowPinId((current) => (current === flowPinId ? null : current));
    },
    [allFlowPins, setAllFlowPins],
  );

  const updateFlowPinFlow = useCallback(
    (flowPinId: string, flow: FlowJSON) => {
      setAllFlowPins(
        allFlowPins.map((item) =>
          item.id === flowPinId
            ? { ...item, flow, name: flow.meta?.name?.trim() || item.name, updatedAt: new Date().toISOString() }
            : item,
        ),
      );
    },
    [allFlowPins, setAllFlowPins],
  );

  const selectFlowPin = useCallback((id: string | null) => setSelectedFlowPinId(id), []);

  return {
    flowPins,
    flowPinsVisible,
    setFlowPinsVisible,
    flowPinModeEnabled,
    setFlowPinModeEnabled,
    flowPinDraft,
    startFlowPinDraft,
    cancelFlowPinDraft,
    submitFlowPinDraft,
    removeFlowPin,
    updateFlowPinFlow,
    selectedFlowPinId,
    selectFlowPin,
  };
}

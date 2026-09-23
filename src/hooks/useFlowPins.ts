import { useCallback, useEffect, useState } from "react";
import type { AnnotationAnchor } from "../types/annotation.types";
import type { DraftFlowPin, FlowPin } from "../types/flowPin.types";
import { createFlowPin, deleteFlowPin, fetchFlowPins } from "../services/flowApi";
import { createClientId } from "../utils/format";
import { isBoolean, usePersistentState } from "./usePersistentState";

interface UseFlowPinsOptions {
  apiBaseUrl: string;
  projectId: string;
  pageKey: string;
  authToken: string | undefined;
  enabled: boolean;
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
  submitFlowPinDraft: (name: string) => Promise<void>;
  removeFlowPin: (flowPinId: string) => Promise<void>;
  syncFlowPinName: (flowPinId: string, name: string) => void;
  selectedFlowPinId: string | null;
  selectFlowPin: (id: string | null) => void;
}

/** Flow pins are attached to page elements the same way tags are; each pin owns a
 * server-side flow that the pin's panel loads and saves through the flow document API. */
export function useFlowPins(options: UseFlowPinsOptions): FlowPinsState {
  const { apiBaseUrl, projectId, pageKey, authToken, enabled } = options;
  const [flowPins, setFlowPins] = useState<FlowPin[]>([]);
  const [flowPinsVisible, setFlowPinsVisible] = usePersistentState(
    `wpn-ui:${projectId}:flowPinsVisible`,
    true,
    isBoolean,
  );
  const [flowPinModeEnabled, setFlowPinModeEnabledState] = useState(false);
  const [flowPinDraft, setFlowPinDraft] = useState<DraftFlowPin | null>(null);
  const [selectedFlowPinId, setSelectedFlowPinId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setFlowPins([]);
      setSelectedFlowPinId(null);
      return;
    }
    const controller = new AbortController();
    fetchFlowPins(apiBaseUrl, authToken, projectId, pageKey, controller.signal)
      .then(setFlowPins)
      .catch(() => undefined);
    return () => controller.abort();
  }, [apiBaseUrl, authToken, projectId, pageKey, enabled]);

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
    async (name: string) => {
      if (!flowPinDraft) {
        return;
      }
      const created = await createFlowPin(apiBaseUrl, authToken, {
        projectId,
        pageKey,
        name: name.trim() || flowPinDraft.label,
        anchor: flowPinDraft.anchor,
      });
      setFlowPins((current) => [created, ...current]);
      setFlowPinDraft(null);
      setFlowPinModeEnabledState(false);
      setSelectedFlowPinId(created.id);
    },
    [apiBaseUrl, authToken, flowPinDraft, pageKey, projectId],
  );

  const removeFlowPin = useCallback(
    async (flowPinId: string) => {
      await deleteFlowPin(apiBaseUrl, authToken, flowPinId);
      setFlowPins((current) => current.filter((item) => item.id !== flowPinId));
      setSelectedFlowPinId((current) => (current === flowPinId ? null : current));
    },
    [apiBaseUrl, authToken],
  );

  const syncFlowPinName = useCallback((flowPinId: string, name: string) => {
    setFlowPins((current) =>
      current.map((item) =>
        item.id === flowPinId && item.name !== name ? { ...item, name } : item,
      ),
    );
  }, []);

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
    syncFlowPinName,
    selectedFlowPinId,
    selectFlowPin,
  };
}

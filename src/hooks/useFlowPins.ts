import { useCallback, useEffect, useMemo, useState } from "react";
import type { AnnotationAnchor } from "../types/annotation.types";
import type { DraftFlowPin, FlowPin } from "../types/flowPin.types";
import { createFlowPin, deleteFlowPin, fetchFlowPins } from "../services/flowApi";
import { createClientId } from "../utils/format";
import { usePersistentState } from "./usePersistentState";
import { isBoolean } from "../utils/valueGuards";
import { useTokenGetter } from "./useTokenGetter";

const LOAD_ERROR_MESSAGE = "Could not load flows for this page";

interface UseFlowPinsOptions {
  apiBaseUrl: string;
  projectId: string;
  pageKey: string;
  getAuthToken: (() => string | Promise<string>) | undefined;
  sessionKey: string | null;
  enabled: boolean;
}

export interface FlowPinsState {
  flowPins: FlowPin[];
  flowPinsError: string | null;
  reloadFlowPins: () => void;
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

export function useFlowPins(options: UseFlowPinsOptions): FlowPinsState {
  const { apiBaseUrl, projectId, pageKey, getAuthToken, sessionKey, enabled } = options;
  const getToken = useTokenGetter(getAuthToken);
  const [flowPins, setFlowPins] = useState<FlowPin[]>([]);
  const [flowPinsError, setFlowPinsError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [flowPinsVisible, setFlowPinsVisible] = usePersistentState(
    `wpn-ui:${projectId}:flowPinsVisible`,
    true,
    isBoolean,
  );
  const [flowPinModeEnabled, setFlowPinModeEnabledState] = useState(false);
  const [flowPinDraft, setFlowPinDraft] = useState<DraftFlowPin | null>(null);
  const [selectedFlowPinId, setSelectedFlowPinId] = useState<string | null>(null);

  useEffect(() => {
    setFlowPins([]);
    setFlowPinsError(null);
    setFlowPinDraft(null);
  }, [projectId, pageKey, sessionKey]);

  useEffect(() => {
    if (!enabled) {
      setFlowPins([]);
      setSelectedFlowPinId(null);
      return;
    }
    const controller = new AbortController();
    getToken()
      .then((token) => fetchFlowPins(apiBaseUrl, token, projectId, pageKey, controller.signal))
      .then((loaded) => {
        setFlowPins(loaded);
        setFlowPinsError(null);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFlowPinsError(LOAD_ERROR_MESSAGE);
        }
      });
    return () => controller.abort();
  }, [apiBaseUrl, getToken, sessionKey, projectId, pageKey, enabled, reloadToken]);

  const reloadFlowPins = useCallback(() => setReloadToken((token) => token + 1), []);

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
      const created = await createFlowPin(apiBaseUrl, await getToken(), {
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
    [apiBaseUrl, getToken, flowPinDraft, pageKey, projectId],
  );

  const removeFlowPin = useCallback(
    async (flowPinId: string) => {
      await deleteFlowPin(apiBaseUrl, await getToken(), flowPinId);
      setFlowPins((current) => current.filter((item) => item.id !== flowPinId));
      setSelectedFlowPinId((current) => (current === flowPinId ? null : current));
    },
    [apiBaseUrl, getToken],
  );

  const syncFlowPinName = useCallback((flowPinId: string, name: string) => {
    setFlowPins((current) =>
      current.map((item) =>
        item.id === flowPinId && item.name !== name ? { ...item, name } : item,
      ),
    );
  }, []);

  const selectFlowPin = useCallback((id: string | null) => setSelectedFlowPinId(id), []);

  return useMemo(
    () => ({
      flowPins,
      flowPinsError,
      reloadFlowPins,
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
    }),
    [
      flowPins,
      flowPinsError,
      reloadFlowPins,
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
    ],
  );
}

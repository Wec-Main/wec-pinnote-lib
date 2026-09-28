import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnnotationAnchor } from "../types/annotation.types";
import type { DraftFlowPin, FlowPin } from "../types/flowPin.types";
import { createFlowPin, deleteFlowPin, fetchFlowPins } from "../services/flowApi";
import { createClientId } from "../utils/format";
import { usePersistentState } from "./usePersistentState";
import { isBoolean } from "../utils/valueGuards";
import { useTokenGetter } from "./useTokenGetter";

const LOAD_ERROR_MESSAGE = "Could not load flows for this page";
const SUBMIT_ERROR_MESSAGE = "Could not create the flow pin";

interface UseFlowPinsOptions {
  apiBaseUrl: string;
  projectId: string;
  projectVersionId?: string;
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
  const { apiBaseUrl, projectId, projectVersionId, pageKey, getAuthToken, sessionKey, enabled } =
    options;
  const getToken = useTokenGetter(getAuthToken);
  const [flowPins, setFlowPins] = useState<FlowPin[]>([]);
  const flowPinsRef = useRef(flowPins);
  flowPinsRef.current = flowPins;
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
  const flowPinsVisibleRef = useRef(flowPinsVisible);
  flowPinsVisibleRef.current = flowPinsVisible;

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
      .then((token) =>
        fetchFlowPins(apiBaseUrl, token, projectId, pageKey, projectVersionId, controller.signal),
      )
      .then((loaded) => {
        if (controller.signal.aborted) {
          return;
        }
        setFlowPins(loaded);
        setFlowPinsError(null);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFlowPinsError(LOAD_ERROR_MESSAGE);
        }
      });
    return () => controller.abort();
  }, [
    apiBaseUrl,
    getToken,
    sessionKey,
    projectId,
    projectVersionId,
    pageKey,
    enabled,
    reloadToken,
  ]);

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
      let created;
      try {
        created = await createFlowPin(apiBaseUrl, await getToken(), {
          projectId,
          projectVersionId,
          pageKey,
          name: name.trim() || flowPinDraft.label,
          anchor: flowPinDraft.anchor,
        });
      } catch (err) {
        setFlowPinsError(SUBMIT_ERROR_MESSAGE);
        throw err;
      }
      setFlowPinsError(null);
      setFlowPins((current) => [created, ...current]);
      setFlowPinDraft(null);
      setFlowPinModeEnabledState(false);
      setSelectedFlowPinId(created.id);
      if (!flowPinsVisibleRef.current) {
        setFlowPinsVisible(true);
      }
    },
    [apiBaseUrl, getToken, flowPinDraft, pageKey, projectId, projectVersionId, setFlowPinsVisible],
  );

  const removeFlowPin = useCallback(
    async (flowPinId: string) => {
      const removed = flowPinsRef.current.find((item) => item.id === flowPinId);
      setFlowPins((current) => current.filter((item) => item.id !== flowPinId));
      setSelectedFlowPinId((current) => (current === flowPinId ? null : current));
      try {
        await deleteFlowPin(apiBaseUrl, await getToken(), flowPinId);
      } catch (err) {
        if (removed) {
          setFlowPins((current) =>
            current.some((item) => item.id === flowPinId) ? current : [...current, removed],
          );
        }
        throw err;
      }
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

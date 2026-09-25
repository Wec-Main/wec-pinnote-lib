import { useCallback, useEffect, useRef, useState } from "react";
import { fetchFlowDocument, publishFlow, saveFlowDocument } from "../services/flowApi";
import type { FlowJSON } from "../types/flowchart.types";
import { parseFlow } from "../utils/flowchart/serialization";
import { AnnotationApiError } from "../types/annotation.types";
import { useTokenGetter } from "./useTokenGetter";

const AUTOSAVE_DELAY_MS = 1200;
const CONFLICT_STATUS = 409;
const CONFLICT_MESSAGE = "This flow was changed elsewhere. Reload to get the latest version.";

export type FlowDocumentStatus = "loading" | "ready" | "error";
export type FlowSaveState = "idle" | "pending" | "saving" | "saved" | "error";

interface UseFlowDocumentOptions {
  apiBaseUrl: string;
  getAuthToken: (() => string | Promise<string>) | undefined;
  sessionKey: string | null;
  flowId: string | null;
  onSaved?: (flowName: string) => void;
}

export interface FlowDocumentState {
  status: FlowDocumentStatus;
  document: FlowJSON | null;
  loadKey: number;
  error: string | null;
  saveError: string | null;
  saveState: FlowSaveState;
  savedCount: number;
  scheduleSave: (flow: FlowJSON) => void;
  save: (flow: FlowJSON) => Promise<void>;
  publish: (flow: FlowJSON) => Promise<void>;
  reload: () => void;
}

interface SaveTarget {
  apiBaseUrl: string;
  flowId: string;
  onSaved: ((flowName: string) => void) | undefined;
}

interface PendingSave {
  target: SaveTarget;
  flow: FlowJSON;
}

function describeError(error: unknown): string {
  if (error instanceof AnnotationApiError && error.status === CONFLICT_STATUS) {
    return CONFLICT_MESSAGE;
  }
  return error instanceof Error && error.message ? error.message : "Could not reach the server";
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useFlowDocument(options: UseFlowDocumentOptions): FlowDocumentState {
  const { apiBaseUrl, flowId, sessionKey } = options;
  const getToken = useTokenGetter(options.getAuthToken);
  const [status, setStatus] = useState<FlowDocumentStatus>("loading");
  const [document, setDocument] = useState<FlowJSON | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<FlowSaveState>("idle");
  const [savedCount, setSavedCount] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);

  const optionsRef = useRef(options);
  optionsRef.current = options;
  const loadedFlowIdRef = useRef<string | null>(null);
  const revisionsRef = useRef(new Map<string, number>());
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<PendingSave | null>(null);
  const lastSentRef = useRef<string | null>(null);

  useEffect(() => {
    loadedFlowIdRef.current = null;
    if (!flowId) {
      setStatus("loading");
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    getToken()
      .then((authToken) => fetchFlowDocument(apiBaseUrl, authToken, flowId, controller.signal))
      .then((record) => {
        revisionsRef.current.set(flowId, record.revision);
        loadedFlowIdRef.current = flowId;
        const loaded = parseFlow(record.document);
        lastSentRef.current = JSON.stringify(loaded);
        setDocument(loaded);
        setLoadKey((key) => key + 1);
        setError(null);
        setSaveError(null);
        setSaveState("idle");
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (isAbort(err)) {
          return;
        }
        setError(describeError(err));
        setStatus("error");
      });
    return () => controller.abort();
  }, [apiBaseUrl, flowId, sessionKey, reloadToken, getToken]);

  const currentTarget = useCallback((): SaveTarget | null => {
    const loadedFlowId = loadedFlowIdRef.current;
    if (!loadedFlowId) {
      return null;
    }
    const current = optionsRef.current;
    return { apiBaseUrl: current.apiBaseUrl, flowId: loadedFlowId, onSaved: current.onSaved };
  }, []);

  const persist = useCallback((target: SaveTarget, flow: FlowJSON): Promise<void> => {
    const isShown = () => loadedFlowIdRef.current === target.flowId;
    lastSentRef.current = JSON.stringify(flow);
    const run = chainRef.current.then(async () => {
      if (isShown()) {
        setSaveState("saving");
      }
      const authToken = await getToken();
      const saved = await saveFlowDocument(
        target.apiBaseUrl,
        authToken,
        target.flowId,
        revisionsRef.current.get(target.flowId) ?? 0,
        flow,
      );
      revisionsRef.current.set(target.flowId, saved.revision);
      if (isShown()) {
        setSaveError(null);
        setSaveState(pendingRef.current ? "pending" : "saved");
        setSavedCount((count) => count + 1);
      }
      target.onSaved?.(saved.flow.name);
    });
    chainRef.current = run.catch(() => undefined);
    return run.catch((err: unknown) => {
      if (isShown()) {
        lastSentRef.current = null;
        setSaveError(describeError(err));
        setSaveState("error");
      }
      throw new Error(describeError(err), { cause: err });
    });
  }, [getToken]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flushPending = useCallback((): Promise<void> => {
    clearTimer();
    const pending = pendingRef.current;
    pendingRef.current = null;
    return pending ? persist(pending.target, pending.flow) : chainRef.current;
  }, [clearTimer, persist]);

  const scheduleSave = useCallback(
    (flow: FlowJSON) => {
      const target = currentTarget();
      if (!target || JSON.stringify(flow) === lastSentRef.current) {
        return;
      }
      pendingRef.current = { target, flow };
      setSaveState((state) => (state === "saving" || state === "error" ? state : "pending"));
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        flushPending().catch(() => undefined);
      }, AUTOSAVE_DELAY_MS);
    },
    [clearTimer, currentTarget, flushPending],
  );

  const save = useCallback(
    (flow: FlowJSON) => {
      clearTimer();
      pendingRef.current = null;
      const target = currentTarget();
      return target ? persist(target, flow) : Promise.resolve();
    },
    [clearTimer, currentTarget, persist],
  );

  const publish = useCallback(
    async (flow: FlowJSON) => {
      const target = currentTarget();
      await save(flow);
      if (target) {
        const authToken = await getToken();
        await publishFlow(target.apiBaseUrl, authToken, target.flowId);
      }
    },
    [currentTarget, getToken, save],
  );

  useEffect(() => () => void flushPending().catch(() => undefined), [flowId, flushPending]);

  const reload = useCallback(() => {
    clearTimer();
    pendingRef.current = null;
    setReloadToken((token) => token + 1);
  }, [clearTimer]);

  return {
    status,
    document,
    loadKey,
    error,
    saveError,
    saveState,
    savedCount,
    scheduleSave,
    save,
    publish,
    reload,
  };
}

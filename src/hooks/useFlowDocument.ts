import { useCallback, useEffect, useRef, useState } from "react";
import { fetchFlowDocument, publishFlow, saveFlowDocument } from "../services/flowApi";
import { parseFlow, type FlowJSON } from "../components/WecFlow/flowchart";
import { AnnotationApiError } from "../types/annotation.types";

const AUTOSAVE_DELAY_MS = 1200;
const CONFLICT_STATUS = 409;
const CONFLICT_MESSAGE = "This flow was changed elsewhere. Reload to get the latest version.";

export type FlowDocumentStatus = "loading" | "ready" | "error";
export type FlowSaveState = "idle" | "pending" | "saving" | "saved" | "error";

interface UseFlowDocumentOptions {
  apiBaseUrl: string;
  authToken: string | undefined;
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

function describeError(error: unknown): string {
  if (error instanceof AnnotationApiError && error.status === CONFLICT_STATUS) {
    return CONFLICT_MESSAGE;
  }
  return error instanceof Error && error.message ? error.message : "Could not reach the server";
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Loads one flow from the API and keeps it saved: edits autosave after a short pause,
 * saves run one at a time against the latest server revision, and a stale revision
 * surfaces as a conflict instead of overwriting someone else's work. */
export function useFlowDocument(options: UseFlowDocumentOptions): FlowDocumentState {
  const { apiBaseUrl, authToken, flowId } = options;
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
  const revisionRef = useRef(0);
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<FlowJSON | null>(null);
  const lastSentRef = useRef<string | null>(null);

  useEffect(() => {
    if (!flowId) {
      setStatus("loading");
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    fetchFlowDocument(apiBaseUrl, authToken, flowId, controller.signal)
      .then((record) => {
        revisionRef.current = record.revision;
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
  }, [apiBaseUrl, authToken, flowId, reloadToken]);

  const persist = useCallback((flow: FlowJSON): Promise<void> => {
    lastSentRef.current = JSON.stringify(flow);
    const run = chainRef.current.then(async () => {
      const current = optionsRef.current;
      if (!current.flowId) {
        return;
      }
      setSaveState("saving");
      const saved = await saveFlowDocument(
        current.apiBaseUrl,
        current.authToken,
        current.flowId,
        revisionRef.current,
        flow,
      );
      revisionRef.current = saved.revision;
      setSaveError(null);
      setSaveState(pendingRef.current ? "pending" : "saved");
      setSavedCount((count) => count + 1);
      current.onSaved?.(saved.flow.name);
    });
    chainRef.current = run.catch(() => undefined);
    return run.catch((err: unknown) => {
      lastSentRef.current = null;
      setSaveError(describeError(err));
      setSaveState("error");
      throw new Error(describeError(err), { cause: err });
    });
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flushPending = useCallback((): Promise<void> => {
    clearTimer();
    const flow = pendingRef.current;
    pendingRef.current = null;
    return flow ? persist(flow) : chainRef.current;
  }, [clearTimer, persist]);

  const scheduleSave = useCallback(
    (flow: FlowJSON) => {
      if (JSON.stringify(flow) === lastSentRef.current) {
        return;
      }
      pendingRef.current = flow;
      setSaveState((state) => (state === "saving" || state === "error" ? state : "pending"));
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        flushPending().catch(() => undefined);
      }, AUTOSAVE_DELAY_MS);
    },
    [clearTimer, flushPending],
  );

  const save = useCallback(
    (flow: FlowJSON) => {
      clearTimer();
      pendingRef.current = null;
      return persist(flow);
    },
    [clearTimer, persist],
  );

  const publish = useCallback(
    async (flow: FlowJSON) => {
      await save(flow);
      const current = optionsRef.current;
      if (current.flowId) {
        await publishFlow(current.apiBaseUrl, current.authToken, current.flowId);
      }
    },
    [save],
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

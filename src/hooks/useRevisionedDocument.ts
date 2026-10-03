import { useCallback, useEffect, useRef, useState } from "react";
import { AnnotationApiError } from "../types/annotation.types";
import { useTokenGetter } from "./useTokenGetter";

export const AUTOSAVE_DELAY_MS = 1200;
const CONFLICT_STATUS = 409;

export type DocumentStatus = "loading" | "ready" | "error";
export type DocumentSaveState = "idle" | "pending" | "saving" | "saved" | "error";

export interface RevisionedDocumentAdapter<T> {
  load: (
    apiBaseUrl: string,
    authToken: string | undefined,
    documentId: string,
    signal: AbortSignal,
  ) => Promise<{ revision: number; document: unknown }>;
  save: (
    apiBaseUrl: string,
    authToken: string | undefined,
    documentId: string,
    revision: number,
    document: T,
  ) => Promise<{ revision: number; name: string }>;
  publish: (
    apiBaseUrl: string,
    authToken: string | undefined,
    documentId: string,
  ) => Promise<unknown>;
  parse: (raw: unknown) => T;
  conflictMessage: string;
}

export interface UseRevisionedDocumentOptions<T> {
  apiBaseUrl: string;
  getAuthToken: (() => string | Promise<string>) | undefined;
  sessionKey: string | null;
  documentId: string | null;
  adapter: RevisionedDocumentAdapter<T>;
  onSaved?: (name: string) => void;
  onSaveFailed?: (documentId: string, message: string) => void;
  autosave?: boolean;
  holdAutosave?: boolean;
}

export interface RevisionedDocumentState<T> {
  status: DocumentStatus;
  document: T | null;
  loadKey: number;
  error: string | null;
  saveError: string | null;
  saveState: DocumentSaveState;
  savedCount: number;
  hasUnsavedChanges: boolean;
  revision: number | null;
  scheduleSave: (document: T) => void;
  save: (document: T) => Promise<void>;
  publish: (document: T) => Promise<void>;
  reload: () => void;
  applyRemoteRevision: (revision: number) => void;
}

interface SaveTarget {
  apiBaseUrl: string;
  documentId: string;
  onSaved: ((name: string) => void) | undefined;
  onSaveFailed: ((documentId: string, message: string) => void) | undefined;
}

interface PendingSave<T> {
  target: SaveTarget;
  document: T;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useRevisionedDocument<T>(
  options: UseRevisionedDocumentOptions<T>,
): RevisionedDocumentState<T> {
  const { apiBaseUrl, documentId, sessionKey } = options;
  const getToken = useTokenGetter(options.getAuthToken);
  const [status, setStatus] = useState<DocumentStatus>("loading");
  const [document, setDocument] = useState<T | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<DocumentSaveState>("idle");
  const [savedCount, setSavedCount] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [revision, setRevision] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const autosave = options.autosave !== false;
  const holdAutosave = options.holdAutosave === true;
  const holdRef = useRef(holdAutosave);
  holdRef.current = holdAutosave;

  const optionsRef = useRef(options);
  optionsRef.current = options;
  const loadedDocumentIdRef = useRef<string | null>(null);
  const revisionsRef = useRef(new Map<string, number>());
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<PendingSave<T> | null>(null);
  const lastSentRef = useRef<string | null>(null);
  const loadGenerationRef = useRef(0);

  const describeError = useCallback((err: unknown): string => {
    if (err instanceof AnnotationApiError && err.status === CONFLICT_STATUS) {
      return optionsRef.current.adapter.conflictMessage;
    }
    return err instanceof Error && err.message ? err.message : "Could not reach the server";
  }, []);

  useEffect(() => {
    loadedDocumentIdRef.current = null;
    loadGenerationRef.current += 1;
    const generation = loadGenerationRef.current;
    if (!documentId) {
      setStatus("loading");
      return;
    }
    const controller = new AbortController();
    const { adapter } = optionsRef.current;
    setStatus("loading");
    getToken()
      .then((authToken) => adapter.load(apiBaseUrl, authToken, documentId, controller.signal))
      .then((record) => {
        if (generation !== loadGenerationRef.current) {
          return;
        }
        revisionsRef.current.set(documentId, record.revision);
        loadedDocumentIdRef.current = documentId;
        const loaded = adapter.parse(record.document);
        lastSentRef.current = JSON.stringify(loaded);
        setDocument(loaded);
        setLoadKey((key) => key + 1);
        setError(null);
        setSaveError(null);
        setSaveState("idle");
        setHasUnsavedChanges(false);
        setRevision(record.revision);
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
  }, [apiBaseUrl, documentId, sessionKey, reloadToken, getToken, describeError]);

  const currentTarget = useCallback((): SaveTarget | null => {
    const loadedDocumentId = loadedDocumentIdRef.current;
    if (!loadedDocumentId) {
      return null;
    }
    const current = optionsRef.current;
    return {
      apiBaseUrl: current.apiBaseUrl,
      documentId: loadedDocumentId,
      onSaved: current.onSaved,
      onSaveFailed: current.onSaveFailed,
    };
  }, []);

  const persist = useCallback(
    (target: SaveTarget, next: T): Promise<void> => {
      const generation = loadGenerationRef.current;
      const isCurrent = () => generation === loadGenerationRef.current;
      const isShown = () => isCurrent() && loadedDocumentIdRef.current === target.documentId;
      lastSentRef.current = JSON.stringify(next);
      const run = chainRef.current.then(async () => {
        if (isShown()) {
          setSaveState("saving");
        }
        const authToken = await getToken();
        const saved = await optionsRef.current.adapter.save(
          target.apiBaseUrl,
          authToken,
          target.documentId,
          revisionsRef.current.get(target.documentId) ?? 0,
          next,
        );
        if (isCurrent()) {
          revisionsRef.current.set(target.documentId, saved.revision);
        }
        if (isShown()) {
          setRevision(saved.revision);
          setSaveError(null);
          setSaveState(pendingRef.current ? "pending" : "saved");
          setSavedCount((count) => count + 1);
        }
        target.onSaved?.(saved.name);
      });
      chainRef.current = run.catch(() => undefined);
      return run.catch((err: unknown) => {
        const message = describeError(err);
        if (isShown()) {
          lastSentRef.current = null;
          setSaveError(message);
          setSaveState("error");
        } else {
          target.onSaveFailed?.(target.documentId, message);
        }
        throw new Error(message, { cause: err });
      });
    },
    [getToken, describeError],
  );

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
    return pending ? persist(pending.target, pending.document) : chainRef.current;
  }, [clearTimer, persist]);

  const scheduleSave = useCallback(
    (next: T) => {
      const target = currentTarget();
      if (!target) {
        return;
      }
      if (JSON.stringify(next) === lastSentRef.current) {
        if ((!autosave || holdRef.current) && pendingRef.current) {
          pendingRef.current = null;
          setHasUnsavedChanges(false);
          setSaveState((state) => (state === "pending" ? "idle" : state));
        }
        return;
      }
      pendingRef.current = { target, document: next };
      setSaveState((state) => (state === "saving" || state === "error" ? state : "pending"));
      if (!autosave || holdRef.current) {
        clearTimer();
        setHasUnsavedChanges(true);
        return;
      }
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (holdRef.current) {
          setHasUnsavedChanges(true);
          return;
        }
        flushPending().then(
          () => {
            if (!pendingRef.current) {
              setHasUnsavedChanges(false);
            }
          },
          () => undefined,
        );
      }, AUTOSAVE_DELAY_MS);
    },
    [autosave, clearTimer, currentTarget, flushPending],
  );

  const save = useCallback(
    (next: T) => {
      clearTimer();
      pendingRef.current = null;
      const target = currentTarget();
      if (!target) {
        return Promise.resolve();
      }
      return persist(target, next).then(
        () => {
          if (!pendingRef.current) {
            setHasUnsavedChanges(false);
          }
        },
        (err: unknown) => {
          if (!autosave || holdRef.current) {
            setHasUnsavedChanges(true);
          }
          throw err;
        },
      );
    },
    [autosave, clearTimer, currentTarget, persist],
  );

  const publish = useCallback(
    async (next: T) => {
      const before = currentTarget();
      const unchanged = !pendingRef.current && JSON.stringify(next) === lastSentRef.current;
      if (!unchanged) await save(next);
      const after = currentTarget();
      if (!before || !after || before.documentId !== after.documentId) {
        return;
      }
      const authToken = await getToken();
      await optionsRef.current.adapter.publish(after.apiBaseUrl, authToken, after.documentId);
    },
    [currentTarget, getToken, save],
  );

  useEffect(() => {
    if (holdAutosave && timerRef.current) {
      clearTimer();
      if (pendingRef.current) {
        setHasUnsavedChanges(true);
      }
    }
  }, [holdAutosave, clearTimer]);

  useEffect(
    () => () => {
      if (autosave && !holdRef.current) {
        void flushPending().catch(() => undefined);
      } else {
        pendingRef.current = null;
      }
    },
    [autosave, documentId, flushPending],
  );

  const reload = useCallback(() => {
    clearTimer();
    pendingRef.current = null;
    setHasUnsavedChanges(false);
    loadGenerationRef.current += 1;
    setReloadToken((token) => token + 1);
  }, [clearTimer]);

  const applyRemoteRevision = useCallback(
    (revision: number) => {
      if (!documentId || pendingRef.current) {
        return;
      }
      if (revision <= (revisionsRef.current.get(documentId) ?? 0)) {
        return;
      }
      reload();
    },
    [documentId, reload],
  );

  return {
    status,
    document,
    loadKey,
    error,
    saveError,
    saveState,
    savedCount,
    hasUnsavedChanges,
    revision,
    scheduleSave,
    save,
    publish,
    reload,
    applyRemoteRevision,
  };
}

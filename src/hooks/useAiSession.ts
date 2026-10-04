import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  EMPTY_AI_SESSION_VIEW,
  loadSessionDetail,
  markDraftStale,
  messageList,
  prependMessages,
  type AiMessageStore,
  type AiSessionViewState,
  type AiStreamingDraft,
} from "../features/ai/sessionReducer";
import { aiSessionCacheKey } from "../features/ai/cacheKeys";
import { AI_SESSION_DETAIL_TTL_MS } from "../features/ai/prefetch";
import { AiSessionViewStore, type AiDraftStore } from "../features/ai/sessionViewStore";
import { useAiRuntimeActions } from "../features/ai/AiRuntimeContext";
import { fetchResource, readResource, writeResource } from "../utils/resourceCache";
import { createClientMessageId } from "../utils/ai/aiStreamGuards";
import {
  fetchAiSession,
  fetchAiSessionMessages,
  interruptAiSession,
  sendAiMessage,
  updateAiSession,
} from "../services/aiService";
import { AnnotationApiError } from "../types/annotation.types";
import {
  AI_ACTIVE_TURN_STATUSES,
  type AiSession,
  type AiSessionDetail,
  type AiStreamEvent,
  type AiTurn,
  type SendAiMessageRequest,
  type SendAiMessageResponse,
  type UpdateAiSessionRequest,
} from "../types/ai.types";

const OLDER_PAGE_SIZE = 100;

export interface AiSessionState {
  detail: AiSessionDetail | null;
  messages: AiMessageStore;
  turns: Readonly<Record<string, AiTurn>>;
  draft: AiStreamingDraft | null;
  draftStore: AiDraftStore;
  deleted: boolean;
  loading: boolean;
  error: string | null;
  errorStatus: number | null;
  loadingOlder: boolean;
  send: (input: SendAiMessageRequest) => Promise<SendAiMessageResponse>;
  interrupt: () => Promise<AiTurn | null>;
  update: (input: UpdateAiSessionRequest) => Promise<AiSession | null>;
  loadOlder: () => Promise<void>;
  reload: () => void;
}

function isActiveTurn(turn: AiTurn): boolean {
  return AI_ACTIVE_TURN_STATUSES.includes(turn.status);
}

function describe(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Could not load the AI session";
}

export function needsResync(view: AiSessionViewState): boolean {
  if (view.draft) return true;
  if (view.meta?.session.activeTurn && isActiveTurn(view.meta.session.activeTurn)) return true;
  return Object.values(view.turns).some(isActiveTurn);
}

export function isMissingSessionStatus(status: number | null): boolean {
  return status === 404 || status === 403;
}

interface FetchState {
  id: string | null;
  loading: boolean;
  error: string | null;
  errorStatus: number | null;
}

function seedView(apiBaseUrl: string, aiSessionId: string | null): AiSessionViewState {
  if (!aiSessionId) return EMPTY_AI_SESSION_VIEW;
  const cached = readResource<AiSessionDetail>(aiSessionCacheKey(apiBaseUrl, aiSessionId)).data;
  return cached ? loadSessionDetail(EMPTY_AI_SESSION_VIEW, cached) : EMPTY_AI_SESSION_VIEW;
}

export function useAiSession(aiSessionId: string | null): AiSessionState {
  const { apiBaseUrl, enabled, getToken, subscribe } = useAiRuntimeActions();
  const [fetchState, setFetchState] = useState<FetchState>({
    id: null,
    loading: false,
    error: null,
    errorStatus: null,
  });
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const active = enabled && Boolean(aiSessionId);

  const store = useMemo(
    () => new AiSessionViewStore(seedView(apiBaseUrl, aiSessionId), aiSessionId),
    [apiBaseUrl, aiSessionId],
  );
  useEffect(() => () => store.dispose(), [store]);
  const view = useSyncExternalStore(store.subscribeView, store.getView, store.getView);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    if (!active || !aiSessionId) return undefined;
    let cancelled = false;
    const controller = new AbortController();
    const cacheKey = aiSessionCacheKey(apiBaseUrl, aiSessionId);
    setFetchState({ id: aiSessionId, loading: true, error: null, errorStatus: null });
    const load: Promise<AiSessionDetail | undefined> =
      reloadToken > 0
        ? getToken()
            .then((authToken) =>
              fetchAiSession(apiBaseUrl, authToken, aiSessionId, controller.signal),
            )
            .then((detail) => {
              writeResource(cacheKey, detail);
              return detail;
            })
        : fetchResource<AiSessionDetail>(
            cacheKey,
            async (signal) => fetchAiSession(apiBaseUrl, await getToken(), aiSessionId, signal),
            { ttlMs: AI_SESSION_DETAIL_TTL_MS, retries: 0, detached: true },
          ).then((detail) => {
            const snapshot = readResource<AiSessionDetail>(cacheKey);
            if (!detail && snapshot.error) throw snapshot.error;
            return detail;
          });
    load
      .then((detail) => {
        if (cancelled || !detail) return;
        store.update((current) => loadSessionDetail(current, detail));
        setFetchState({ id: aiSessionId, loading: false, error: null, errorStatus: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFetchState({
          id: aiSessionId,
          loading: false,
          error: describe(err),
          errorStatus: err instanceof AnnotationApiError ? err.status : null,
        });
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [active, aiSessionId, apiBaseUrl, getToken, reloadToken, store]);

  useEffect(() => {
    if (!active || !aiSessionId) return undefined;
    return subscribe(
      (event) => {
        if (event.type === "ai_resync") {
          store.flush();
          if (needsResync(store.getView())) reload();
          return;
        }
        store.dispatch(event);
      },
      (reconnect) => {
        if (reconnect.resumed) return;
        store.update(markDraftStale);
        reload();
      },
    );
  }, [active, aiSessionId, reload, store, subscribe]);

  const stale = Boolean(view.draft?.stale);
  useEffect(() => {
    if (stale) reload();
  }, [reload, stale]);

  const applyLocal = useCallback(
    (event: AiStreamEvent) => {
      store.dispatch(event);
    },
    [store],
  );

  const send = useCallback(
    async (input: SendAiMessageRequest) => {
      if (!aiSessionId) throw new Error("No AI session is open");
      const authToken = await getToken();
      const response = await sendAiMessage(apiBaseUrl, authToken, aiSessionId, {
        ...input,
        clientMessageId: input.clientMessageId ?? createClientMessageId(),
      });
      applyLocal({ type: "ai_message.upserted", message: response.message });
      applyLocal({ type: "ai_turn.upserted", turn: response.turn });
      return response;
    },
    [aiSessionId, apiBaseUrl, applyLocal, getToken],
  );

  const interrupt = useCallback(async () => {
    if (!aiSessionId) return null;
    const authToken = await getToken();
    const turn = await interruptAiSession(apiBaseUrl, authToken, aiSessionId);
    applyLocal({ type: "ai_turn.upserted", turn });
    return turn;
  }, [aiSessionId, apiBaseUrl, applyLocal, getToken]);

  const update = useCallback(
    async (input: UpdateAiSessionRequest) => {
      if (!aiSessionId) return null;
      const authToken = await getToken();
      const session = await updateAiSession(apiBaseUrl, authToken, aiSessionId, input);
      applyLocal({ type: "ai_session.upserted", session });
      return session;
    },
    [aiSessionId, apiBaseUrl, applyLocal, getToken],
  );

  const loadOlder = useCallback(async () => {
    const current = store.getView();
    if (!aiSessionId || !current.meta || !current.meta.hasMoreMessages) return;
    const oldestId = current.messages.order[0];
    setLoadingOlder(true);
    try {
      const authToken = await getToken();
      const page = await fetchAiSessionMessages(apiBaseUrl, authToken, aiSessionId, {
        before: oldestId,
        limit: OLDER_PAGE_SIZE,
      });
      store.update((state) => prependMessages(state, page.messages, page.hasMore));
    } finally {
      setLoadingOlder(false);
    }
  }, [aiSessionId, apiBaseUrl, getToken, store]);

  const current = fetchState.id === aiSessionId ? fetchState : null;
  const fetching = active && (current === null || current.loading);
  const { meta, messages } = view;
  const detail = useMemo<AiSessionDetail | null>(
    () => (meta ? { ...meta, messages: messageList(messages) } : null),
    [meta, messages],
  );

  return {
    detail,
    messages,
    turns: view.turns,
    draft: view.draft,
    draftStore: store,
    deleted: view.deleted,
    loading: fetching && !view.meta,
    error: current?.error ?? null,
    errorStatus: current?.errorStatus ?? null,
    loadingOlder,
    send,
    interrupt,
    update,
    loadOlder,
    reload,
  };
}

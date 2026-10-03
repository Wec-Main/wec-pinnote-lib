import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EMPTY_AI_SESSION_VIEW,
  loadSessionDetail,
  markDraftStale,
  messageList,
  prependMessages,
  reduceSessionView,
  type AiMessageStore,
  type AiSessionViewState,
  type AiStreamingDraft,
} from "../ai/sessionReducer";
import { useAiRuntime } from "../context/AiRuntimeContext";
import {
  fetchAiSession,
  fetchAiSessionMessages,
  interruptAiSession,
  sendAiMessage,
  updateAiSession,
} from "../services/aiApi";
import { AnnotationApiError } from "../types/annotation.types";
import type {
  AiSession,
  AiSessionDetail,
  AiStreamEvent,
  AiTurn,
  SendAiMessageRequest,
  SendAiMessageResponse,
  UpdateAiSessionRequest,
} from "../types/ai.types";

const OLDER_PAGE_SIZE = 100;

export interface AiSessionState {
  detail: AiSessionDetail | null;
  messages: AiMessageStore;
  turns: Readonly<Record<string, AiTurn>>;
  draft: AiStreamingDraft | null;
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

function describe(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Could not load the AI session";
}

export function isMissingSessionStatus(status: number | null): boolean {
  return status === 404 || status === 403;
}

export function useAiSession(aiSessionId: string | null): AiSessionState {
  const { apiBaseUrl, enabled, getToken, subscribe } = useAiRuntime();
  const [view, setView] = useState<AiSessionViewState>(EMPTY_AI_SESSION_VIEW);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const viewRef = useRef(view);
  viewRef.current = view;
  const active = enabled && Boolean(aiSessionId);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    setView(EMPTY_AI_SESSION_VIEW);
    setError(null);
    setErrorStatus(null);
  }, [aiSessionId]);

  useEffect(() => {
    if (!active || !aiSessionId) return undefined;
    const controller = new AbortController();
    setLoading(true);
    getToken()
      .then((authToken) => fetchAiSession(apiBaseUrl, authToken, aiSessionId, controller.signal))
      .then((detail) => {
        if (controller.signal.aborted) return;
        setView((current) => loadSessionDetail(current, detail));
        setError(null);
        setErrorStatus(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(describe(err));
        setErrorStatus(err instanceof AnnotationApiError ? err.status : null);
        setLoading(false);
      });
    return () => controller.abort();
  }, [active, aiSessionId, apiBaseUrl, getToken, reloadToken]);

  useEffect(() => {
    if (!active || !aiSessionId) return undefined;
    return subscribe(
      (event) => setView((current) => reduceSessionView(current, aiSessionId, event)),
      () => {
        setView((current) => markDraftStale(current));
        reload();
      },
    );
  }, [active, aiSessionId, reload, subscribe]);

  const stale = Boolean(view.draft?.stale);
  useEffect(() => {
    if (stale) reload();
  }, [reload, stale]);

  const applyLocal = useCallback(
    (event: AiStreamEvent) => {
      if (aiSessionId) setView((current) => reduceSessionView(current, aiSessionId, event));
    },
    [aiSessionId],
  );

  const send = useCallback(
    async (input: SendAiMessageRequest) => {
      if (!aiSessionId) throw new Error("No AI session is open");
      const authToken = await getToken();
      const response = await sendAiMessage(apiBaseUrl, authToken, aiSessionId, input);
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
    const current = viewRef.current;
    if (!aiSessionId || !current.meta || !current.meta.hasMoreMessages) return;
    const oldestId = current.messages.order[0];
    setLoadingOlder(true);
    try {
      const authToken = await getToken();
      const page = await fetchAiSessionMessages(apiBaseUrl, authToken, aiSessionId, {
        before: oldestId,
        limit: OLDER_PAGE_SIZE,
      });
      setView((state) => prependMessages(state, page.messages, page.hasMore));
    } finally {
      setLoadingOlder(false);
    }
  }, [aiSessionId, apiBaseUrl, getToken]);

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
    deleted: view.deleted,
    loading,
    error,
    errorStatus,
    loadingOlder,
    send,
    interrupt,
    update,
    loadOlder,
    reload,
  };
}

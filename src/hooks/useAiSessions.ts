import { useCallback, useEffect, useRef, useState } from "react";
import { reduceSessionList, type AiSessionFilter } from "../ai/sessionReducer";
import { useAiRuntime } from "../context/AiRuntimeContext";
import { updateAiSession } from "../services/aiApi";
import { aiSessionsCacheKey } from "../ai/cacheKeys";
import { loadAiSessionPage, type AiSessionPage } from "../ai/prefetch";
import { withRequestTimeout } from "../utils/requestTimeout";
import { useCachedResource } from "./useCachedResource";
import type { AiSession } from "../types/ai.types";

const DEFAULT_PAGE = 50;
const MAX_LIMIT = 200;
const SESSIONS_TTL_MS = 20_000;
export const SESSIONS_TIMEOUT_MS = 20_000;
const EMPTY_SESSIONS: AiSession[] = [];

export interface UseAiSessionsOptions extends AiSessionFilter {
  limit?: number;
  enabled?: boolean;
}

export interface AiSessionsState {
  sessions: AiSession[];
  loading: boolean;
  refreshing?: boolean;
  showSkeleton?: boolean;
  error: string | null;
  hasMore: boolean;
  reload: () => void;
  loadMore: () => void;
  rename: (aiSessionId: string, title: string) => Promise<AiSession | null>;
  archive: (aiSessionId: string, archived?: boolean) => Promise<AiSession | null>;
}

function describe(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Could not load AI sessions";
}

export function useAiSessions(filter: UseAiSessionsOptions = {}): AiSessionsState {
  const { apiBaseUrl, projectId, enabled, currentUserId, getToken, subscribe } = useAiRuntime();
  const active = enabled && filter.enabled !== false && Boolean(projectId);
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const { scopeKind, scopeId, mine, includeArchived, includeActions } = filter;
  const pageSize = filter.limit ?? DEFAULT_PAGE;
  const [limit, setLimit] = useState(pageSize);

  useEffect(() => {
    setLimit(pageSize);
  }, [pageSize, scopeKind, scopeId, mine, includeArchived, includeActions, projectId]);

  const key = active
    ? aiSessionsCacheKey({
        apiBaseUrl,
        projectId,
        scopeKind,
        scopeId,
        mine,
        includeArchived,
        includeActions,
        limit,
      })
    : null;

  const resource = useCachedResource<AiSessionPage>(
    key,
    (signal) =>
      withRequestTimeout(signal, SESSIONS_TIMEOUT_MS, (guarded) =>
        loadAiSessionPage(
          { apiBaseUrl, projectId, getToken },
          { scopeKind, scopeId, mine, includeArchived, includeActions, limit },
          guarded,
        ),
      ),
    { ttlMs: SESSIONS_TTL_MS, keepPrevious: true },
  );
  const { update, refresh } = resource;
  const sessions = active ? (resource.data?.sessions ?? EMPTY_SESSIONS) : EMPTY_SESSIONS;
  const rawCount = resource.data?.rawCount ?? 0;
  const error = resource.error ? describe(resource.error) : null;

  const reload = useCallback(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!active) return undefined;
    return subscribe(
      (event) =>
        update((current) => ({
          ...current,
          sessions: reduceSessionList(current.sessions, event, filterRef.current, currentUserId),
        })),
      reload,
    );
  }, [active, currentUserId, update, reload, subscribe]);

  const hasMore = rawCount >= limit && limit < MAX_LIMIT;

  const loadMore = useCallback(() => {
    setLimit((current) => Math.min(MAX_LIMIT, current + pageSize));
  }, [pageSize]);

  const patch = useCallback(
    async (aiSessionId: string, input: { title?: string; archived?: boolean }) => {
      const authToken = await getToken();
      const session = await updateAiSession(apiBaseUrl, authToken, aiSessionId, input);
      update((current) => ({
        ...current,
        sessions: reduceSessionList(
          current.sessions,
          { type: "ai_session.upserted", session },
          filterRef.current,
          currentUserId,
        ),
      }));
      return session;
    },
    [apiBaseUrl, currentUserId, getToken, update],
  );

  const rename = useCallback(
    async (aiSessionId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return null;
      return patch(aiSessionId, { title: trimmed });
    },
    [patch],
  );

  const archive = useCallback(
    (aiSessionId: string, archived = true) => patch(aiSessionId, { archived }),
    [patch],
  );

  return {
    sessions,
    loading: active && resource.isLoading,
    refreshing: resource.isRefreshing,
    showSkeleton: resource.showSkeleton,
    error,
    hasMore,
    reload,
    loadMore,
    rename,
    archive,
  };
}

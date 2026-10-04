import {
  fetchAiMe,
  fetchAiSession,
  listAiActionTemplates,
  listAiSessions,
} from "../../services/aiService";
import type {
  AiActionTemplate,
  AiMe,
  AiScopeKind,
  AiSession,
  AiSessionDetail,
} from "../../types/ai.types";
import { sortSessions } from "./sessionReducer";
import { prefetchResource } from "../../utils/resourceCache";
import {
  aiMeCacheKey,
  aiSessionCacheKey,
  aiSessionsCacheKey,
  aiTemplatesCacheKey,
} from "./cacheKeys";

export { AI_TEMPLATES_CACHE_KEY, aiTemplatesCacheKey } from "./cacheKeys";

export interface AiPrefetchTarget {
  apiBaseUrl: string;
  projectId: string;
  getToken: () => Promise<string | undefined>;
}

export function prefetchAiActionTemplates(
  target: AiPrefetchTarget,
): Promise<AiActionTemplate[] | undefined> {
  const { apiBaseUrl, projectId, getToken } = target;
  if (!projectId) return Promise.resolve(undefined);
  return prefetchResource<AiActionTemplate[]>(
    aiTemplatesCacheKey(apiBaseUrl, projectId),
    async (signal) => listAiActionTemplates(apiBaseUrl, await getToken(), projectId, signal),
    { ttlMs: 60_000, retries: 1 },
  );
}

export function prefetchAiMe(
  target: AiPrefetchTarget,
  sessionKey?: string | null,
): Promise<AiMe | undefined> {
  const { apiBaseUrl, projectId, getToken } = target;
  if (!projectId) return Promise.resolve(undefined);
  return prefetchResource<AiMe>(
    aiMeCacheKey(apiBaseUrl, projectId, sessionKey),
    async (signal) => fetchAiMe(apiBaseUrl, await getToken(), projectId, signal),
    { ttlMs: 20_000, retries: 0 },
  );
}

export const AI_SESSION_DETAIL_TTL_MS = 5_000;

export function prefetchAiSession(
  target: AiPrefetchTarget,
  aiSessionId: string | null | undefined,
): Promise<AiSessionDetail | undefined> {
  if (!aiSessionId) return Promise.resolve(undefined);
  const { apiBaseUrl, getToken } = target;
  return prefetchResource<AiSessionDetail>(
    aiSessionCacheKey(apiBaseUrl, aiSessionId),
    async (signal) => fetchAiSession(apiBaseUrl, await getToken(), aiSessionId, signal),
    { ttlMs: AI_SESSION_DETAIL_TTL_MS, retries: 0 },
  );
}

export interface AiSessionPage {
  sessions: AiSession[];
  rawCount: number;
}

export interface AiSessionQuery {
  scopeKind?: AiScopeKind;
  scopeId?: string | null;
  mine?: boolean;
  includeArchived?: boolean;
  includeActions?: boolean;
  limit?: number;
}

export async function loadAiSessionPage(
  target: AiPrefetchTarget,
  query: AiSessionQuery,
  signal?: AbortSignal,
): Promise<AiSessionPage> {
  const { apiBaseUrl, projectId, getToken } = target;
  const list = await listAiSessions(
    apiBaseUrl,
    await getToken(),
    {
      projectId,
      scopeKind: query.scopeKind,
      scopeId: query.scopeId ?? undefined,
      mine: query.mine,
      kind: query.includeActions ? "all" : undefined,
      limit: query.limit,
    },
    signal,
  );
  return {
    rawCount: list.length,
    sessions: sortSessions(list.filter((s) => query.includeArchived || !s.archivedAt)),
  };
}

export function prefetchAiSessions(
  target: AiPrefetchTarget,
  query: AiSessionQuery = { limit: 50 },
): Promise<AiSessionPage | undefined> {
  if (!target.projectId) return Promise.resolve(undefined);
  return prefetchResource<AiSessionPage>(
    aiSessionsCacheKey({ apiBaseUrl: target.apiBaseUrl, projectId: target.projectId, ...query }),
    (signal) => loadAiSessionPage(target, query, signal),
    { ttlMs: 20_000, retries: 1 },
  );
}

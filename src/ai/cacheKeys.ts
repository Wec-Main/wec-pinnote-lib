export const AI_ME_CACHE_KEY = "ai:me";
export const AI_SESSIONS_CACHE_KEY = "ai:sessions";
export const AI_TEMPLATES_CACHE_KEY = "ai:templates";
export const AI_SESSION_CACHE_KEY = "ai:session";

function scoped(
  prefix: string,
  parts: ReadonlyArray<string | number | boolean | null | undefined>,
) {
  return [
    prefix,
    ...parts.map((part) => (part === null || part === undefined ? "" : String(part))),
  ].join("|");
}

export function aiMeCacheKey(
  apiBaseUrl: string,
  projectId: string,
  sessionKey?: string | null,
): string {
  return scoped(AI_ME_CACHE_KEY, [apiBaseUrl, projectId, sessionKey]);
}

export function aiTemplatesCacheKey(apiBaseUrl: string, projectId: string): string {
  return scoped(AI_TEMPLATES_CACHE_KEY, [apiBaseUrl, projectId]);
}

export interface AiSessionsKeyParts {
  apiBaseUrl: string;
  projectId: string;
  scopeKind?: string;
  scopeId?: string | null;
  mine?: boolean;
  includeArchived?: boolean;
  includeActions?: boolean;
  limit?: number;
}

export function aiSessionsCacheKey(parts: AiSessionsKeyParts): string {
  return scoped(AI_SESSIONS_CACHE_KEY, [
    parts.apiBaseUrl,
    parts.projectId,
    parts.scopeKind,
    parts.scopeId,
    Boolean(parts.mine),
    Boolean(parts.includeArchived),
    Boolean(parts.includeActions),
    parts.limit,
  ]);
}

export function aiSessionCacheKey(apiBaseUrl: string, aiSessionId: string): string {
  return scoped(AI_SESSION_CACHE_KEY, [apiBaseUrl, aiSessionId]);
}

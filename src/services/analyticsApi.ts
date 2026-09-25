import { AnnotationApiError } from "../types/annotation.types";
import { buildUrl, request, requestBlob } from "./httpClient";
import type {
  AnalyticsFilters,
  AnalyticsSummary,
  AnalyticsTrends,
  ExportVisitsQuery,
  PageVisitPage,
  PagesQuery,
  TopUsersPage,
  UsersQuery,
  VisitsPage,
  VisitsQuery,
} from "../types/analytics.types";

export interface AnalyticsStreamTicket {
  ticket: string;
  expiresInSeconds: number;
}

export interface AnalyticsStreamScope {
  organizationId?: string;
  projectId?: string;
}

function isAnalyticsStreamTicket(payload: unknown): payload is AnalyticsStreamTicket {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const ticket = payload as Record<string, unknown>;
  return (
    typeof ticket.ticket === "string" &&
    ticket.ticket.length > 0 &&
    typeof ticket.expiresInSeconds === "number"
  );
}

function isAnalyticsSummary(payload: unknown): payload is AnalyticsSummary {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const summary = payload as Record<string, unknown>;
  return (
    typeof summary.range === "object" &&
    summary.range !== null &&
    typeof summary.activeNow === "number" &&
    typeof summary.activeUsers === "object" &&
    typeof summary.logins === "object" &&
    typeof summary.comments === "object" &&
    typeof summary.annotations === "object" &&
    typeof summary.visits === "object"
  );
}

function isPageVisitPage(payload: unknown): payload is PageVisitPage {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const page = payload as Record<string, unknown>;
  return (
    Array.isArray(page.pages) &&
    typeof page.limit === "number" &&
    typeof page.offset === "number"
  );
}

function isAnalyticsTrends(payload: unknown): payload is AnalyticsTrends {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  return Array.isArray((payload as Record<string, unknown>).days);
}

function isTopUsersPage(payload: unknown): payload is TopUsersPage {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const page = payload as Record<string, unknown>;
  return (
    Array.isArray(page.users) &&
    typeof page.limit === "number" &&
    typeof page.offset === "number"
  );
}

function isVisitsPage(payload: unknown): payload is VisitsPage {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const page = payload as Record<string, unknown>;
  return (
    Array.isArray(page.visits) &&
    typeof page.limit === "number" &&
    typeof page.offset === "number"
  );
}

export async function fetchAnalyticsSummary(
  apiBaseUrl: string,
  authToken: string | undefined,
  filters: AnalyticsFilters,
  signal?: AbortSignal,
): Promise<AnalyticsSummary> {
  const payload = await request<unknown>(
    buildUrl(apiBaseUrl, "/analytics/summary", { ...filters }),
    authToken,
    { signal },
    { fallbackMessage: (status) => `Unable to load analytics summary (${status})` },
  );
  if (!isAnalyticsSummary(payload)) {
    throw new AnnotationApiError("Unexpected analytics summary response", 500, JSON.stringify(payload));
  }
  return payload;
}

export async function fetchAnalyticsPages(
  apiBaseUrl: string,
  authToken: string | undefined,
  filters: AnalyticsFilters,
  limit?: number,
  offset?: number,
  signal?: AbortSignal,
): Promise<PageVisitPage> {
  const query: PagesQuery = { ...filters, limit, offset };
  const payload = await request<unknown>(
    buildUrl(apiBaseUrl, "/analytics/pages", { ...query }),
    authToken,
    { signal },
    { fallbackMessage: (status) => `Unable to load page visits (${status})` },
  );
  if (!isPageVisitPage(payload)) {
    throw new AnnotationApiError("Unexpected page visits response", 500, JSON.stringify(payload));
  }
  return payload;
}

export async function fetchAnalyticsTrends(
  apiBaseUrl: string,
  authToken: string | undefined,
  filters: AnalyticsFilters,
  signal?: AbortSignal,
): Promise<AnalyticsTrends> {
  const payload = await request<unknown>(
    buildUrl(apiBaseUrl, "/analytics/trends", { ...filters }),
    authToken,
    { signal },
    { fallbackMessage: (status) => `Unable to load analytics trends (${status})` },
  );
  if (!isAnalyticsTrends(payload)) {
    throw new AnnotationApiError("Unexpected analytics trends response", 500, JSON.stringify(payload));
  }
  return payload;
}

export async function fetchAnalyticsUsers(
  apiBaseUrl: string,
  authToken: string | undefined,
  filters: AnalyticsFilters,
  limit?: number,
  offset?: number,
  signal?: AbortSignal,
): Promise<TopUsersPage> {
  const query: UsersQuery = { ...filters, limit, offset };
  const payload = await request<unknown>(
    buildUrl(apiBaseUrl, "/analytics/users", { ...query }),
    authToken,
    { signal },
    { fallbackMessage: (status) => `Unable to load top users (${status})` },
  );
  if (!isTopUsersPage(payload)) {
    throw new AnnotationApiError("Unexpected top users response", 500, JSON.stringify(payload));
  }
  return payload;
}

export async function fetchAnalyticsVisits(
  apiBaseUrl: string,
  authToken: string | undefined,
  query: VisitsQuery,
  signal?: AbortSignal,
): Promise<VisitsPage> {
  const payload = await request<unknown>(
    buildUrl(apiBaseUrl, "/analytics/visits", { ...query }),
    authToken,
    { signal },
    { fallbackMessage: (status) => `Unable to load the visit log (${status})` },
  );
  if (!isVisitsPage(payload)) {
    throw new AnnotationApiError("Unexpected visit log response", 500, JSON.stringify(payload));
  }
  return payload;
}

export async function downloadAnalyticsVisitsCsv(
  apiBaseUrl: string,
  authToken: string | undefined,
  query: ExportVisitsQuery,
  signal?: AbortSignal,
): Promise<Blob> {
  return requestBlob(
    buildUrl(apiBaseUrl, "/analytics/visits/export", { ...query }),
    authToken,
    { signal },
    { fallbackMessage: (status) => `Unable to export the visit log (${status})` },
  );
}

export async function fetchAnalyticsStreamTicket(
  apiBaseUrl: string,
  authToken: string | undefined,
  scope: AnalyticsStreamScope,
  signal?: AbortSignal,
): Promise<AnalyticsStreamTicket> {
  const payload = await request<unknown>(
    buildUrl(apiBaseUrl, "/analytics/events/ticket", { ...scope }),
    authToken,
    { method: "POST", signal },
    { fallbackMessage: (status) => `Unable to start live updates (${status})` },
  );
  if (!isAnalyticsStreamTicket(payload)) {
    throw new AnnotationApiError("Unexpected live update ticket response", 500, JSON.stringify(payload));
  }
  return payload;
}

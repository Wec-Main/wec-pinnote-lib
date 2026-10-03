import { AnnotationApiError } from "../types/annotation.types";
import { buildUrl, request, requestBlob } from "./httpClient";
import type {
  AnalyticsFilters,
  AnalyticsOverview,
  ExportVisitsQuery,
  PageVisitPage,
  PagesQuery,
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAnalyticsOverview(payload: unknown): payload is AnalyticsOverview {
  if (!isObject(payload)) {
    return false;
  }
  const { range, kpis, trends, topPages, topUsers } = payload;
  return (
    isObject(range) &&
    isObject(kpis) &&
    isObject(kpis.users) &&
    isObject(kpis.logins) &&
    isObject(kpis.comments) &&
    isObject(kpis.annotations) &&
    isObject(trends) &&
    Array.isArray(trends.days) &&
    Array.isArray(topPages) &&
    Array.isArray(topUsers)
  );
}

function isPageVisitPage(payload: unknown): payload is PageVisitPage {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const page = payload as Record<string, unknown>;
  return (
    Array.isArray(page.pages) && typeof page.limit === "number" && typeof page.offset === "number"
  );
}

function isVisitsPage(payload: unknown): payload is VisitsPage {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const page = payload as Record<string, unknown>;
  return (
    Array.isArray(page.visits) && typeof page.limit === "number" && typeof page.offset === "number"
  );
}

export async function fetchAnalyticsOverview(
  apiBaseUrl: string,
  authToken: string | undefined,
  filters: AnalyticsFilters,
  signal?: AbortSignal,
): Promise<AnalyticsOverview> {
  const payload = await request<unknown>(
    buildUrl(apiBaseUrl, "/analytics/overview", { ...filters }),
    authToken,
    { signal },
    { fallbackMessage: (status) => `Unable to load analytics (${status})` },
  );
  if (!isAnalyticsOverview(payload)) {
    throw new AnnotationApiError(
      "Unexpected analytics overview response",
      500,
      JSON.stringify(payload),
    );
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
    throw new AnnotationApiError(
      "Unexpected live update ticket response",
      500,
      JSON.stringify(payload),
    );
  }
  return payload;
}

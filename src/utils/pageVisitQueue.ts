import type { OpenPageView, PageVisitRecord } from "../types/pageVisit.types";

export const FLUSH_INTERVAL_MS = 5000;
export const HEARTBEAT_INTERVAL_MS = 60000;
export const CONTINUATION_WINDOW_MS = 5000;
export const MAX_BATCH_VISITS = 50;
export const MAX_BATCH_BYTES = 60000;
export const MAX_QUEUED_VISITS = 200;
export const INGEST_TOKEN_RENEW_MARGIN_MS = 120000;

const MIN_DURATION_MS = 0;
const MAX_DURATION_MS = 86400000;
const MIN_SCROLL_DEPTH = 0;
const MAX_SCROLL_DEPTH = 100;

export function isTrackingEnabled(
  trackPageVisits: boolean | undefined,
  authenticated: boolean,
): boolean {
  return trackPageVisits !== false && authenticated;
}

export function isContinuation(
  previous: { pageKey: string; leftAtMs: number } | undefined,
  pageKey: string,
  enteredAtMs: number,
  resumed: boolean,
): boolean {
  if (resumed) {
    return true;
  }
  if (!previous || previous.pageKey !== pageKey) {
    return false;
  }
  return enteredAtMs - previous.leftAtMs <= CONTINUATION_WINDOW_MS;
}

export function scrollDepthPercent(
  scrollY: number,
  viewportHeight: number,
  documentHeight: number,
): number {
  const scrollable = documentHeight - viewportHeight;
  if (scrollable <= 0) {
    return 100;
  }
  const percent = (scrollY / scrollable) * 100;
  return Math.min(MAX_SCROLL_DEPTH, Math.max(MIN_SCROLL_DEPTH, Math.round(percent)));
}

export function finalizeVisit(
  openView: OpenPageView,
  leftAtMs: number,
  title: string | null,
): PageVisitRecord {
  const rawDuration = leftAtMs - openView.enteredAtMs;
  const durationMs = Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, rawDuration));
  return {
    clientVisitId: openView.clientVisitId,
    sessionId: openView.sessionId,
    pageKey: openView.pageKey,
    urlPath: openView.urlPath,
    title,
    referrer: openView.referrer,
    enteredAt: new Date(openView.enteredAtMs).toISOString(),
    durationMs,
    maxScrollDepth: Math.min(
      MAX_SCROLL_DEPTH,
      Math.max(MIN_SCROLL_DEPTH, openView.maxScrollDepth),
    ),
    viewportWidth: openView.viewportWidth,
    viewportHeight: openView.viewportHeight,
    language: openView.language,
    timezone: openView.timezone,
    continuation: openView.continuation,
  };
}

export function pathOnly(url: string): string {
  const withoutHash = url.split("#")[0] ?? "";
  return withoutHash.split("?")[0] ?? "";
}

export function referrerOrigin(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${pathOnly(parsed.pathname)}`;
  } catch {
    return pathOnly(url);
  }
}

export function takeBatch(
  queue: PageVisitRecord[],
  measure: (visits: PageVisitRecord[]) => number,
): { batch: PageVisitRecord[]; remaining: PageVisitRecord[] } {
  const batch: PageVisitRecord[] = [];
  let index = 0;
  while (index < queue.length && batch.length < MAX_BATCH_VISITS) {
    const candidate = queue[index];
    if (!candidate) {
      break;
    }
    const nextBatch = [...batch, candidate];
    if (measure(nextBatch) > MAX_BATCH_BYTES && batch.length > 0) {
      break;
    }
    batch.push(candidate);
    index += 1;
  }
  return { batch, remaining: queue.slice(index) };
}

export function enqueueBounded(
  queue: PageVisitRecord[],
  visit: PageVisitRecord,
): PageVisitRecord[] {
  const next = [...queue, visit];
  if (next.length <= MAX_QUEUED_VISITS) {
    return next;
  }
  return next.slice(next.length - MAX_QUEUED_VISITS);
}

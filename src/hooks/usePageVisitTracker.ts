import { useEffect, useRef } from "react";
import { AnnotationApiError } from "../types/annotation.types";
import type { OpenPageView, PageVisitRecord } from "../types/pageVisit.types";
import { mintIngestToken, sendVisitBatch, type VisitSendMode } from "../services/analyticsIngestApi";
import { createClientId } from "../utils/format";
import {
  FLUSH_INTERVAL_MS,
  HEARTBEAT_INTERVAL_MS,
  INGEST_TOKEN_RENEW_MARGIN_MS,
  MAX_QUEUED_VISITS,
  enqueueBounded,
  finalizeVisit,
  isContinuation,
  pathOnly,
  referrerOrigin,
  scrollDepthPercent,
  takeBatch,
} from "../utils/pageVisitQueue";
import { useTokenGetter } from "./useTokenGetter";

export interface PageVisitTrackerOptions {
  apiBaseUrl: string;
  projectId: string;
  pageKey: string;
  enabled: boolean;
  getAuthToken: (() => string | Promise<string>) | undefined;
  sessionKey: string | null;
}

interface HeldIngestToken {
  token: string;
  expiresAtMs: number;
}

interface LastView {
  pageKey: string;
  leftAtMs: number;
}

interface PageVisitTracker {
  start(pageKey: string): void;
  changePage(pageKey: string): void;
  stop(): void;
}

interface TrackerSettings {
  apiBaseUrl: string;
  projectId: string;
  sessionKey: string;
  getToken: () => Promise<string | undefined>;
}

const MINT_RETRY_MS = HEARTBEAT_INTERVAL_MS;
const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const MAX_PAGE_KEY_LENGTH = 512;
const MAX_URL_LENGTH = 2048;
const MAX_TITLE_LENGTH = 512;
const MAX_LANGUAGE_LENGTH = 35;
const MAX_TIMEZONE_LENGTH = 64;
const MAX_VIEWPORT = 20000;

function storageKey(projectId: string, suffix: "session" | "last-view" | "queue"): string {
  return `wpn-analytics:${projectId}:${suffix}`;
}

function readStorage(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) {
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, value);
    }
  } catch {
    return;
  }
}

function parseStored(key: string): unknown {
  const raw = readStorage(key);
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function readOrCreateSessionId(projectId: string): string {
  const key = storageKey(projectId, "session");
  const stored = readStorage(key);
  if (stored && CLIENT_ID_PATTERN.test(stored)) {
    return stored;
  }
  const created = createClientId("s");
  writeStorage(key, created);
  return created;
}

function readLastView(projectId: string): LastView | undefined {
  const parsed = parseStored(storageKey(projectId, "last-view"));
  if (!parsed || typeof parsed !== "object") {
    return undefined;
  }
  const candidate = parsed as Record<string, unknown>;
  if (typeof candidate.pageKey !== "string" || typeof candidate.leftAtMs !== "number") {
    return undefined;
  }
  return { pageKey: candidate.pageKey, leftAtMs: candidate.leftAtMs };
}

function takePersistedQueue(projectId: string, sessionKey: string): PageVisitRecord[] {
  const key = storageKey(projectId, "queue");
  const parsed = parseStored(key);
  writeStorage(key, null);
  if (!parsed || typeof parsed !== "object") {
    return [];
  }
  const candidate = parsed as Record<string, unknown>;
  if (candidate.sessionKey !== sessionKey || !Array.isArray(candidate.visits)) {
    return [];
  }
  return (candidate.visits as PageVisitRecord[]).slice(-MAX_QUEUED_VISITS);
}

function measureVisitBytes(visits: PageVisitRecord[]): number {
  return new TextEncoder().encode(JSON.stringify(visits)).length;
}

function truncate(value: string, maxLength: number): string {
  return value.slice(0, maxLength);
}

function nullableText(value: string | undefined, maxLength: number): string | null {
  return value ? truncate(value, maxLength) : null;
}

function viewportDimension(value: number): number {
  return Math.min(MAX_VIEWPORT, Math.max(0, Math.round(value)));
}

function resolveTimezone(): string | null {
  try {
    return nullableText(Intl.DateTimeFormat().resolvedOptions().timeZone, MAX_TIMEZONE_LENGTH);
  } catch {
    return null;
  }
}

function currentScrollDepth(): number {
  return scrollDepthPercent(
    window.scrollY,
    window.innerHeight,
    document.documentElement.scrollHeight,
  );
}

function isPageVisible(): boolean {
  return document.visibilityState === "visible";
}

function isPermanentRejection(error: unknown): boolean {
  if (!(error instanceof AnnotationApiError)) {
    return false;
  }
  return error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 429;
}

function createPageVisitTracker(settings: TrackerSettings): PageVisitTracker {
  const { apiBaseUrl, projectId, sessionKey, getToken } = settings;
  const abort = new AbortController();
  const sessionId = readOrCreateSessionId(projectId);
  let queue = takePersistedQueue(projectId, sessionKey);
  let currentPageKey = "";
  let openView: OpenPageView | null = null;
  let openTitle: string | null = null;
  let previousUrl: string | null = null;
  let heldToken: HeldIngestToken | null = null;
  let minting: Promise<HeldIngestToken | null> | null = null;
  let mintBlockedUntilMs = 0;
  let lastSentAtMs = 0;
  let sending = false;
  let scrollFrame = 0;
  let flushTimer: ReturnType<typeof setInterval> | undefined;

  const validToken = (now: number) =>
    heldToken !== null && heldToken.expiresAtMs > now ? heldToken : null;

  const requeue = (batch: PageVisitRecord[]) => {
    queue = [...batch, ...queue].slice(-MAX_QUEUED_VISITS);
  };

  const mint = async (): Promise<HeldIngestToken | null> => {
    try {
      const authToken = await getToken();
      if (!authToken) {
        mintBlockedUntilMs = Date.now() + MINT_RETRY_MS;
        return validToken(Date.now());
      }
      const minted = await mintIngestToken(apiBaseUrl, authToken, projectId, abort.signal);
      heldToken = { token: minted.token, expiresAtMs: Date.parse(minted.expiresAt) };
      return heldToken;
    } catch {
      mintBlockedUntilMs = Date.now() + MINT_RETRY_MS;
      return validToken(Date.now());
    } finally {
      minting = null;
    }
  };

  const ensureToken = (): Promise<HeldIngestToken | null> => {
    const now = Date.now();
    if (heldToken && heldToken.expiresAtMs - now > INGEST_TOKEN_RENEW_MARGIN_MS) {
      return Promise.resolve(heldToken);
    }
    if (minting) {
      return minting;
    }
    if (now < mintBlockedUntilMs || abort.signal.aborted) {
      return Promise.resolve(validToken(now));
    }
    minting = mint();
    return minting;
  };

  const flush = async () => {
    if (sending || abort.signal.aborted) {
      return;
    }
    sending = true;
    try {
      const held = await ensureToken();
      if (!held || abort.signal.aborted) {
        return;
      }
      do {
        const { batch, remaining } = takeBatch(queue, measureVisitBytes);
        queue = remaining;
        try {
          await sendVisitBatch(apiBaseUrl, { token: held.token, visits: batch }, "fetch");
          lastSentAtMs = Date.now();
        } catch (error) {
          if (error instanceof AnnotationApiError && error.status === 401) {
            heldToken = null;
          }
          if (!isPermanentRejection(error)) {
            requeue(batch);
          }
          return;
        }
      } while (queue.length > 0);
    } finally {
      sending = false;
    }
  };

  const flushNow = (mode: VisitSendMode) => {
    if (queue.length === 0) {
      return;
    }
    const now = Date.now();
    const held = validToken(now);
    if (!held) {
      writeStorage(storageKey(projectId, "queue"), JSON.stringify({ sessionKey, visits: queue }));
      queue = [];
      return;
    }
    while (queue.length > 0) {
      const { batch, remaining } = takeBatch(queue, measureVisitBytes);
      queue = remaining;
      sendVisitBatch(apiBaseUrl, { token: held.token, visits: batch }, mode).catch(() => undefined);
    }
    lastSentAtMs = now;
  };

  const openPageView = (pageKey: string, resumed: boolean) => {
    if (!pageKey || openView || !isPageVisible()) {
      return;
    }
    const enteredAtMs = Date.now();
    const trimmedKey = truncate(pageKey, MAX_PAGE_KEY_LENGTH);
    const referrer = previousUrl ?? (document.referrer ? referrerOrigin(document.referrer) : null);
    openTitle = nullableText(document.title, MAX_TITLE_LENGTH);
    openView = {
      pageKey: trimmedKey,
      urlPath: truncate(pathOnly(window.location.pathname) || "/", MAX_URL_LENGTH),
      referrer: referrer ? truncate(referrer, MAX_URL_LENGTH) : null,
      enteredAtMs,
      clientVisitId: createClientId("v"),
      sessionId,
      maxScrollDepth: currentScrollDepth(),
      viewportWidth: viewportDimension(window.innerWidth),
      viewportHeight: viewportDimension(window.innerHeight),
      language: nullableText(navigator.language, MAX_LANGUAGE_LENGTH),
      timezone: resolveTimezone(),
      continuation: isContinuation(readLastView(projectId), trimmedKey, enteredAtMs, resumed),
    };
  };

  const closePageView = (useCurrentTitle: boolean) => {
    const view = openView;
    if (!view) {
      return;
    }
    openView = null;
    const leftAtMs = Date.now();
    const title = useCurrentTitle ? nullableText(document.title, MAX_TITLE_LENGTH) : openTitle;
    queue = enqueueBounded(queue, finalizeVisit(view, leftAtMs, title));
    previousUrl = `${window.location.origin}${view.urlPath}`;
    writeStorage(
      storageKey(projectId, "last-view"),
      JSON.stringify({ pageKey: view.pageKey, leftAtMs }),
    );
  };

  const onScroll = () => {
    if (scrollFrame) {
      return;
    }
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = 0;
      if (openView) {
        openView.maxScrollDepth = Math.max(openView.maxScrollDepth, currentScrollDepth());
        openTitle = nullableText(document.title, MAX_TITLE_LENGTH);
      }
    });
  };

  const hide = () => {
    closePageView(true);
    flushNow("beacon");
  };

  const onVisibilityChange = () => {
    if (isPageVisible()) {
      openPageView(currentPageKey, true);
      void flush();
      return;
    }
    hide();
  };

  const onTick = () => {
    if (!isPageVisible()) {
      return;
    }
    if (queue.length > 0 || Date.now() - lastSentAtMs >= HEARTBEAT_INTERVAL_MS) {
      void flush();
    }
  };

  return {
    start(pageKey) {
      currentPageKey = pageKey;
      document.addEventListener("visibilitychange", onVisibilityChange);
      window.addEventListener("pagehide", hide);
      window.addEventListener("scroll", onScroll, { passive: true });
      flushTimer = setInterval(onTick, FLUSH_INTERVAL_MS);
      openPageView(pageKey, false);
      void flush();
    },
    changePage(pageKey) {
      if (pageKey === currentPageKey) {
        return;
      }
      closePageView(false);
      currentPageKey = pageKey;
      openPageView(pageKey, false);
    },
    stop() {
      closePageView(true);
      flushNow("fetch");
      abort.abort();
      clearInterval(flushTimer);
      if (scrollFrame) {
        window.cancelAnimationFrame(scrollFrame);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("scroll", onScroll);
    },
  };
}

export function usePageVisitTracker({
  apiBaseUrl,
  projectId,
  pageKey,
  enabled,
  getAuthToken,
  sessionKey,
}: PageVisitTrackerOptions): void {
  const getToken = useTokenGetter(getAuthToken);
  const pageKeyRef = useRef(pageKey);
  pageKeyRef.current = pageKey;
  const trackerRef = useRef<PageVisitTracker | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const tracker = createPageVisitTracker({
      apiBaseUrl,
      projectId,
      sessionKey: sessionKey ?? "",
      getToken,
    });
    trackerRef.current = tracker;
    tracker.start(pageKeyRef.current);
    return () => {
      trackerRef.current = null;
      tracker.stop();
    };
  }, [apiBaseUrl, enabled, getToken, projectId, sessionKey]);

  useEffect(() => {
    trackerRef.current?.changePage(pageKey);
  }, [pageKey]);
}

import { useCallback, useEffect, useRef, useState } from "react";
import type { AiStreamEvent } from "../types/ai.types";
import type { StreamConnectionState } from "../types/stream.types";
import { AnnotationApiError } from "../types/annotation.types";
import { fetchAiStreamTicket } from "../services/aiService";
import { normalizeApiBase } from "../services/httpClient";
import { AI_STREAM_EVENT_TYPES, parseAiStreamEvent } from "../utils/ai/aiStreamGuards";
import { withJitter } from "../utils/backoff";
import type { StreamTokenGetter } from "./useSseStream";

const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30000;
const STABLE_OPEN_MS = 5000;
const HIDDEN_PAUSE_MS = 120000;

export interface AiStreamConnection {
  state: StreamConnectionState;
  reconnect: () => void;
}

export interface AiStreamReconnect {
  resumed: boolean;
}

export interface AiStreamOptions {
  apiBaseUrl: string;
  projectId: string;
  getAuthToken: StreamTokenGetter | undefined;
  enabled: boolean;
  onEvent: (event: AiStreamEvent) => void;
  onReconnect?: (reconnect: AiStreamReconnect) => void;
  keepAlive?: () => boolean;
}

function streamUrl(apiBaseUrl: string, ticket: string, lastEventId: string): string {
  const base = normalizeApiBase(apiBaseUrl);
  const url = new URL(`${base}/ai/stream`, window.location.origin);
  url.searchParams.set("ticket", ticket);
  if (lastEventId) {
    url.searchParams.set("lastEventId", lastEventId);
  }
  return url.toString();
}

export function isResumedReady(data: string): boolean {
  try {
    const parsed: unknown = JSON.parse(data);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as { resumed?: unknown }).resumed === true
    );
  } catch {
    return false;
  }
}

function isForbidden(err: unknown): boolean {
  return err instanceof AnnotationApiError && err.status === 403;
}

export function useAiStream(options: AiStreamOptions): StreamConnectionState {
  return useAiStreamConnection(options).state;
}

export function useAiStreamConnection({
  apiBaseUrl,
  projectId,
  getAuthToken,
  enabled,
  onEvent,
  onReconnect,
  keepAlive,
}: AiStreamOptions): AiStreamConnection {
  const [state, setState] = useState<StreamConnectionState>("closed");
  const reconnectFnRef = useRef<() => void>(() => undefined);
  const reconnect = useCallback(() => reconnectFnRef.current(), []);
  const onEventRef = useRef(onEvent);
  const onReconnectRef = useRef(onReconnect);
  const getAuthTokenRef = useRef(getAuthToken);
  const keepAliveRef = useRef(keepAlive);
  keepAliveRef.current = keepAlive;
  onEventRef.current = onEvent;
  onReconnectRef.current = onReconnect;
  getAuthTokenRef.current = getAuthToken;

  useEffect(() => {
    if (
      !enabled ||
      !projectId ||
      typeof window === "undefined" ||
      typeof EventSource === "undefined"
    ) {
      setState("closed");
      return;
    }

    let stopped = false;
    let connecting = false;
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = RECONNECT_DELAY_MS;
    let openedOnce = false;
    let awaitingReady = false;
    let lastEventId = "";
    let ticketController: AbortController | null = null;
    let paused = false;
    let stableTimer: ReturnType<typeof setTimeout> | null = null;
    let hiddenTimer: ReturnType<typeof setTimeout> | null = null;

    const clearStableTimer = () => {
      if (stableTimer) {
        clearTimeout(stableTimer);
        stableTimer = null;
      }
    };

    const clearHiddenTimer = () => {
      if (hiddenTimer) {
        clearTimeout(hiddenTimer);
        hiddenTimer = null;
      }
    };

    const handleMessage = (event: MessageEvent<string>) => {
      const parsed = parseAiStreamEvent(event.type, event.data);
      if (!parsed) {
        return;
      }
      if (event.lastEventId) {
        lastEventId = event.lastEventId;
      }
      reconnectDelay = RECONNECT_DELAY_MS;
      if (parsed.type === "ai_resync" && awaitingReady) {
        return;
      }
      onEventRef.current(parsed);
    };

    const clearReconnectTimer = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (stopped || paused || reconnectTimer) {
        return;
      }
      setState("reconnecting");
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, withJitter(reconnectDelay));
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
    };

    const openSource = (ticket: string) => {
      const next = new EventSource(streamUrl(apiBaseUrl, ticket, lastEventId));
      source = next;
      next.addEventListener("open", () => {
        if (source !== next) {
          return;
        }
        clearStableTimer();
        stableTimer = setTimeout(() => {
          stableTimer = null;
          reconnectDelay = RECONNECT_DELAY_MS;
        }, STABLE_OPEN_MS);
        setState("open");
        if (openedOnce) {
          awaitingReady = true;
        }
        openedOnce = true;
      });
      next.addEventListener("ready", ((event: MessageEvent<string>) => {
        if (source !== next || !awaitingReady) {
          return;
        }
        awaitingReady = false;
        onReconnectRef.current?.({ resumed: isResumedReady(event.data) });
      }) as EventListener);
      next.addEventListener("error", () => {
        if (stopped || source !== next) {
          return;
        }
        clearStableTimer();
        next.close();
        source = null;
        scheduleReconnect();
      });
      for (const type of AI_STREAM_EVENT_TYPES) {
        next.addEventListener(type, handleMessage as EventListener);
      }
    };

    async function connect(): Promise<void> {
      if (stopped || connecting) {
        return;
      }
      connecting = true;
      if (!source) {
        setState(openedOnce ? "reconnecting" : "connecting");
      }
      try {
        let token: string | undefined | null;
        try {
          const getter = getAuthTokenRef.current;
          token = getter ? await getter() : undefined;
        } catch {
          if (!stopped) {
            scheduleReconnect();
          }
          return;
        }
        if (stopped) {
          return;
        }
        if (!token) {
          setState("unauthenticated");
          return;
        }
        const controller = new AbortController();
        ticketController = controller;
        let ticket: string;
        try {
          const issued = await fetchAiStreamTicket(apiBaseUrl, token, projectId, controller.signal);
          ticket = issued.ticket;
        } catch (err) {
          if (stopped) {
            return;
          }
          if (isForbidden(err)) {
            setState("unauthenticated");
            return;
          }
          scheduleReconnect();
          return;
        } finally {
          ticketController = null;
        }
        if (stopped) {
          return;
        }
        openSource(ticket);
      } finally {
        connecting = false;
      }
    }

    const reconnectNow = () => {
      if (stopped || paused || connecting || source) {
        return;
      }
      clearReconnectTimer();
      void connect();
    };

    const closeSource = () => {
      clearStableTimer();
      source?.close();
      source = null;
    };

    const forceReconnect = () => {
      if (stopped) {
        return;
      }
      paused = false;
      clearReconnectTimer();
      closeSource();
      reconnectDelay = RECONNECT_DELAY_MS;
      void connect();
    };
    reconnectFnRef.current = forceReconnect;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        clearHiddenTimer();
        if (paused) {
          paused = false;
          reconnectDelay = RECONNECT_DELAY_MS;
          void connect();
          return;
        }
        reconnectNow();
        return;
      }
      clearHiddenTimer();
      const armHidden = () => {
        hiddenTimer = setTimeout(() => {
          hiddenTimer = null;
          if (stopped || document.visibilityState !== "hidden") {
            return;
          }
          if (keepAliveRef.current?.()) {
            armHidden();
            return;
          }
          pause();
        }, HIDDEN_PAUSE_MS);
      };
      armHidden();
    };

    const pause = () => {
      paused = true;
      clearReconnectTimer();
      ticketController?.abort();
      closeSource();
      setState("closed");
    };

    window.addEventListener("online", reconnectNow);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    void connect();

    return () => {
      stopped = true;
      reconnectFnRef.current = () => undefined;
      clearReconnectTimer();
      clearStableTimer();
      clearHiddenTimer();
      ticketController?.abort();
      window.removeEventListener("online", reconnectNow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      source?.close();
      source = null;
      setState("closed");
    };
  }, [apiBaseUrl, enabled, projectId]);

  return { state, reconnect };
}

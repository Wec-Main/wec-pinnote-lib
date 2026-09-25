import { useEffect, useRef, useState } from "react";
import type { StreamConnectionState, StreamEvent, StreamEventType } from "../types/stream.types";
import { AnnotationApiError } from "../types/annotation.types";
import { fetchSseTicket } from "../services/streamApi";
import { normalizeApiBase } from "../services/httpClient";
import { hasExpiry, isTokenUnexpired } from "../utils/authSession";
import { parseStreamEnvelope } from "../utils/streamPayloadGuards";

const RESYNC_COOLDOWN_MS = 5000;
const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30000;

export type StreamTokenGetter = () =>
  | string
  | undefined
  | null
  | Promise<string | undefined | null>;

export interface SseStreamOptions {
  apiBaseUrl: string;
  projectId: string;
  pageKey: string;
  eventTypes: readonly StreamEventType[];
  getAuthToken: StreamTokenGetter | undefined;
  sessionKey: string;
  enabled: boolean;
  onEvent: (event: StreamEvent) => void;
  onResync: () => void;
}

function streamUrl(apiBaseUrl: string, ticket: string, lastEventId: string | undefined): string {
  const base = normalizeApiBase(apiBaseUrl);
  const url = new URL(`${base}/events`, window.location.origin);
  url.searchParams.set("ticket", ticket);
  if (lastEventId) {
    url.searchParams.set("lastEventId", lastEventId);
  }
  return url.toString();
}

function isAuthFailure(err: unknown): boolean {
  return err instanceof AnnotationApiError && (err.status === 401 || err.status === 403);
}

function isExpiredToken(token: string): boolean {
  return hasExpiry(token) && !isTokenUnexpired(token);
}

export function useSseStream({
  apiBaseUrl,
  projectId,
  pageKey,
  eventTypes,
  getAuthToken,
  sessionKey,
  enabled,
  onEvent,
  onResync,
}: SseStreamOptions): StreamConnectionState {
  const [state, setState] = useState<StreamConnectionState>("closed");
  const onEventRef = useRef(onEvent);
  const onResyncRef = useRef(onResync);
  const getAuthTokenRef = useRef(getAuthToken);
  const eventTypesRef = useRef(eventTypes);
  const lastResyncRef = useRef(0);
  const lastEventRef = useRef<{ scope: string; eventId: string } | null>(null);
  onEventRef.current = onEvent;
  onResyncRef.current = onResync;
  getAuthTokenRef.current = getAuthToken;
  eventTypesRef.current = eventTypes;
  const eventTypesKey = eventTypes.join(",");

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof EventSource === "undefined") {
      setState("closed");
      return;
    }

    const scope = `${apiBaseUrl}|${projectId}|${pageKey}`;
    const types = eventTypesRef.current;
    let stopped = false;
    let connecting = false;
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = RECONNECT_DELAY_MS;
    let openedOnce = false;
    let ticketController: AbortController | null = null;

    const resync = () => {
      const now = Date.now();
      if (now - lastResyncRef.current < RESYNC_COOLDOWN_MS) {
        return;
      }
      lastResyncRef.current = now;
      onResyncRef.current();
    };

    const lastEventId = () =>
      lastEventRef.current?.scope === scope ? lastEventRef.current.eventId : undefined;

    const handleMessage = (event: MessageEvent<string>) => {
      const parsed = parseStreamEnvelope(event.data);
      if (!parsed) {
        resync();
        return;
      }
      lastEventRef.current = { scope, eventId: parsed.eventId };
      if (parsed.truncated) {
        resync();
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
      if (stopped || reconnectTimer) {
        return;
      }
      setState("reconnecting");
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
    };

    const resolveToken = async (): Promise<string | undefined | null> => {
      const getter = getAuthTokenRef.current;
      return getter ? await getter() : undefined;
    };

    const openSource = (ticket: string) => {
      const next = new EventSource(streamUrl(apiBaseUrl, ticket, lastEventId()));
      source = next;

      next.addEventListener("open", () => {
        reconnectDelay = RECONNECT_DELAY_MS;
        setState("open");
        if (openedOnce) {
          resync();
        }
        openedOnce = true;
      });

      next.addEventListener("error", () => {
        if (stopped || source !== next) {
          return;
        }
        next.close();
        source = null;
        scheduleReconnect();
      });

      next.addEventListener("replay-failed", () => {
        resync();
      });

      for (const type of types) {
        next.addEventListener(type, handleMessage as EventListener);
      }
    };

    async function connect(): Promise<void> {
      if (stopped || connecting) {
        return;
      }
      connecting = true;
      setState(openedOnce ? "reconnecting" : "connecting");
      try {
        let token: string | undefined | null;
        try {
          token = await resolveToken();
        } catch {
          if (!stopped) {
            scheduleReconnect();
          }
          return;
        }
        if (stopped) {
          return;
        }
        if (!token || isExpiredToken(token)) {
          setState("unauthenticated");
          return;
        }

        const controller = new AbortController();
        ticketController = controller;
        let ticket: string;
        try {
          ticket = (await fetchSseTicket(apiBaseUrl, token, projectId, pageKey, controller.signal))
            .ticket;
        } catch (err) {
          if (stopped) {
            return;
          }
          if (isAuthFailure(err)) {
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
      if (stopped || connecting || source) {
        return;
      }
      clearReconnectTimer();
      reconnectDelay = RECONNECT_DELAY_MS;
      void connect();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        reconnectNow();
      }
    };

    window.addEventListener("online", reconnectNow);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    void connect();

    return () => {
      stopped = true;
      clearReconnectTimer();
      ticketController?.abort();
      window.removeEventListener("online", reconnectNow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      source?.close();
      source = null;
      setState("closed");
    };
  }, [apiBaseUrl, enabled, eventTypesKey, pageKey, projectId, sessionKey]);

  return state;
}

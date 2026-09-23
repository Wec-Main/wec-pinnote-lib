import { useEffect, useRef, useState } from "react";
import type { StreamConnectionState, StreamEvent, StreamEventType } from "../types/stream.types";
import { AnnotationApiError } from "../types/annotation.types";
import { fetchSseTicket } from "../services/streamApi";
import { isTokenUnexpired } from "./useAuthSessions";

const EPICFLOW_PAGE_KEY = "__epicflow__";

const EVENT_TYPES: StreamEventType[] = [
  "epic.created",
  "epic.updated",
  "epic.deleted",
  "user_story.created",
  "user_story.updated",
  "user_story.deleted",
];

const RESYNC_COOLDOWN_MS = 5000;
const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30000;

function streamUrl(apiBaseUrl: string, ticket: string, lastEventId: string | undefined): string {
  const base = apiBaseUrl.replace(/\/+$/, "");
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

export interface EpicFlowStreamOptions {
  apiBaseUrl: string;
  projectId: string;
  getAuthToken: (() => string | Promise<string>) | undefined;
  enabled: boolean;
  onEvent: (event: StreamEvent) => void;
  onResync: () => void;
}

export function useEpicFlowStream({
  apiBaseUrl,
  projectId,
  getAuthToken,
  enabled,
  onEvent,
  onResync,
}: EpicFlowStreamOptions): StreamConnectionState {
  const [state, setState] = useState<StreamConnectionState>("closed");
  const onEventRef = useRef(onEvent);
  const onResyncRef = useRef(onResync);
  const getAuthTokenRef = useRef(getAuthToken);
  const lastResyncRef = useRef(0);
  onEventRef.current = onEvent;
  onResyncRef.current = onResync;
  getAuthTokenRef.current = getAuthToken;

  const resync = () => {
    const now = Date.now();
    if (now - lastResyncRef.current < RESYNC_COOLDOWN_MS) {
      return;
    }
    lastResyncRef.current = now;
    onResyncRef.current();
  };

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof EventSource === "undefined") {
      setState("closed");
      return;
    }

    let stopped = false;
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = RECONNECT_DELAY_MS;
    let lastEventId: string | undefined;
    let openedOnce = false;

    const handleMessage = (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data) as StreamEvent;
        lastEventId = parsed.eventId;
        if (parsed.truncated) {
          resync();
          return;
        }
        onEventRef.current(parsed);
      } catch {
        resync();
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

    async function connect(): Promise<void> {
      if (stopped) {
        return;
      }
      setState(openedOnce ? "reconnecting" : "connecting");

      const resolvedToken = await getAuthTokenRef.current?.();
      if (stopped) {
        return;
      }
      if (!resolvedToken || !isTokenUnexpired(resolvedToken)) {
        setState("unauthenticated");
        return;
      }

      let ticket: string;
      try {
        ticket = (await fetchSseTicket(apiBaseUrl, resolvedToken, projectId, EPICFLOW_PAGE_KEY))
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
      }
      if (stopped) {
        return;
      }
      source = new EventSource(streamUrl(apiBaseUrl, ticket, lastEventId));

      source.addEventListener("open", () => {
        reconnectDelay = RECONNECT_DELAY_MS;
        setState("open");
        if (openedOnce) {
          resync();
        }
        openedOnce = true;
      });

      source.addEventListener("error", () => {
        if (stopped) {
          return;
        }
        source?.close();
        source = null;
        scheduleReconnect();
      });

      source.addEventListener("replay-failed", () => {
        resync();
      });

      for (const type of EVENT_TYPES) {
        source.addEventListener(type, handleMessage as EventListener);
      }
    }

    void connect();

    return () => {
      stopped = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      source?.close();
      setState("closed");
    };
  }, [apiBaseUrl, enabled, projectId]);

  return state;
}

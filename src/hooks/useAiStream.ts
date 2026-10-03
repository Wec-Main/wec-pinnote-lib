import { useEffect, useRef, useState } from "react";
import type { AiStreamEvent } from "../types/ai.types";
import type { StreamConnectionState } from "../types/stream.types";
import { AnnotationApiError } from "../types/annotation.types";
import { fetchAiStreamTicket } from "../services/aiApi";
import { normalizeApiBase } from "../services/httpClient";
import { AI_STREAM_EVENT_TYPES, parseAiStreamEvent } from "../utils/aiStreamGuards";
import { withJitter } from "../utils/backoff";
import type { StreamTokenGetter } from "./useSseStream";

const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30000;

export interface AiStreamOptions {
  apiBaseUrl: string;
  projectId: string;
  getAuthToken: StreamTokenGetter | undefined;
  enabled: boolean;
  onEvent: (event: AiStreamEvent) => void;
  onReconnect?: () => void;
}

function streamUrl(apiBaseUrl: string, ticket: string): string {
  const base = normalizeApiBase(apiBaseUrl);
  const url = new URL(`${base}/ai/stream`, window.location.origin);
  url.searchParams.set("ticket", ticket);
  return url.toString();
}

function isForbidden(err: unknown): boolean {
  return err instanceof AnnotationApiError && err.status === 403;
}

export function useAiStream({
  apiBaseUrl,
  projectId,
  getAuthToken,
  enabled,
  onEvent,
  onReconnect,
}: AiStreamOptions): StreamConnectionState {
  const [state, setState] = useState<StreamConnectionState>("closed");
  const onEventRef = useRef(onEvent);
  const onReconnectRef = useRef(onReconnect);
  const getAuthTokenRef = useRef(getAuthToken);
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
    let ticketController: AbortController | null = null;

    const handleMessage = (event: MessageEvent<string>) => {
      const parsed = parseAiStreamEvent(event.type, event.data);
      if (parsed) {
        onEventRef.current(parsed);
      }
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
      }, withJitter(reconnectDelay));
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
    };

    const openSource = (ticket: string) => {
      const next = new EventSource(streamUrl(apiBaseUrl, ticket));
      source = next;
      next.addEventListener("open", () => {
        if (source !== next) {
          return;
        }
        reconnectDelay = RECONNECT_DELAY_MS;
        setState("open");
        if (openedOnce) {
          onReconnectRef.current?.();
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
      if (stopped || connecting || source) {
        return;
      }
      clearReconnectTimer();
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
  }, [apiBaseUrl, enabled, projectId]);

  return state;
}

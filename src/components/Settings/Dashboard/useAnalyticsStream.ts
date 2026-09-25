import { useEffect, useRef, useState } from "react";
import {
  fetchAnalyticsStreamTicket,
  type AnalyticsStreamScope,
} from "../../../services/analyticsApi";
import { normalizeApiBase } from "../../../services/httpClient";
import { AnnotationApiError } from "../../../types/annotation.types";
import {
  INITIAL_RECONNECT_DELAY_MS,
  nextReconnectDelay,
  parseAnalyticsChange,
  streamStateAfterFailure,
  type AnalyticsChangeKind,
  type AnalyticsStreamState,
} from "./analyticsStreamState";

export interface AnalyticsStreamOptions {
  apiBaseUrl: string;
  authToken: string | undefined;
  scope: AnalyticsStreamScope;
  enabled: boolean;
  onChange: (kinds: AnalyticsChangeKind[]) => void;
  onResync: () => void;
}

function analyticsStreamUrl(apiBaseUrl: string, ticket: string): string {
  const base = normalizeApiBase(apiBaseUrl);
  const url = new URL(`${base}/analytics/events`, window.location.origin);
  url.searchParams.set("ticket", ticket);
  return url.toString();
}

function failureStatus(err: unknown): number | undefined {
  return err instanceof AnnotationApiError ? err.status : undefined;
}

export function useAnalyticsStream({
  apiBaseUrl,
  authToken,
  scope,
  enabled,
  onChange,
  onResync,
}: AnalyticsStreamOptions): AnalyticsStreamState {
  const [state, setState] = useState<AnalyticsStreamState>("connecting");
  const onChangeRef = useRef(onChange);
  const onResyncRef = useRef(onResync);
  onChangeRef.current = onChange;
  onResyncRef.current = onResync;
  const { organizationId, projectId } = scope;

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof EventSource === "undefined") {
      setState("connecting");
      return;
    }
    if (!authToken) {
      setState("offline");
      return;
    }

    const ticketScope: AnalyticsStreamScope = { organizationId, projectId };
    let stopped = false;
    let connecting = false;
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
    let openedOnce = false;
    let ticketController: AbortController | null = null;

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
      reconnectDelay = nextReconnectDelay(reconnectDelay);
    };

    const handleChange = (event: MessageEvent<string>) => {
      const kinds = parseAnalyticsChange(event.data);
      if (kinds) {
        onChangeRef.current(kinds);
      }
    };

    const openSource = (ticket: string) => {
      const next = new EventSource(analyticsStreamUrl(apiBaseUrl, ticket));
      source = next;

      next.addEventListener("open", () => {
        reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
        setState("live");
        if (openedOnce) {
          onResyncRef.current();
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

      next.addEventListener("resync", () => {
        onResyncRef.current();
      });

      next.addEventListener("analytics.changed", handleChange as EventListener);
    };

    async function connect(): Promise<void> {
      if (stopped || connecting) {
        return;
      }
      connecting = true;
      setState(openedOnce ? "reconnecting" : "connecting");
      const controller = new AbortController();
      ticketController = controller;
      try {
        const { ticket } = await fetchAnalyticsStreamTicket(
          apiBaseUrl,
          authToken,
          ticketScope,
          controller.signal,
        );
        if (!stopped) {
          openSource(ticket);
        }
      } catch (err) {
        if (stopped) {
          return;
        }
        if (streamStateAfterFailure(failureStatus(err)) === "offline") {
          setState("offline");
          return;
        }
        scheduleReconnect();
      } finally {
        ticketController = null;
        connecting = false;
      }
    }

    const reconnectNow = () => {
      if (stopped || connecting || source) {
        return;
      }
      clearReconnectTimer();
      reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
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
    };
  }, [apiBaseUrl, authToken, enabled, organizationId, projectId]);

  return state;
}

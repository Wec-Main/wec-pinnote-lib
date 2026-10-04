import { useEffect, useRef, useState } from "react";
import {
  fetchAnalyticsStreamTicket,
  type AnalyticsStreamScope,
} from "../../../../services/analyticsService";
import { normalizeApiBase } from "../../../../services/httpClient";
import { AnnotationApiError } from "../../../../types/annotation.types";
import {
  INITIAL_RECONNECT_DELAY_MS,
  createReloadScheduler,
  nextReconnectDelay,
  parseAnalyticsChange,
  streamStateAfterFailure,
  type AnalyticsStreamState,
} from "./analyticsStreamState";
import { withJitter } from "../../../../utils/backoff";

export interface AnalyticsStreamOptions {
  apiBaseUrl: string;
  getToken: () => Promise<string | undefined>;
  identity: string;
  scope: AnalyticsStreamScope;
  enabled: boolean;
  onReload: () => void;
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

function isHidden(): boolean {
  return document.visibilityState === "hidden";
}

export function useAnalyticsStream({
  apiBaseUrl,
  getToken,
  identity,
  scope,
  enabled,
  onReload,
}: AnalyticsStreamOptions): AnalyticsStreamState {
  const [state, setState] = useState<AnalyticsStreamState>("connecting");
  const onReloadRef = useRef(onReload);
  onReloadRef.current = onReload;
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const { organizationId, projectId } = scope;

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof EventSource === "undefined") {
      setState("connecting");
      return;
    }

    const ticketScope: AnalyticsStreamScope = { organizationId, projectId };
    const scheduler = createReloadScheduler({ reload: () => onReloadRef.current() });
    let stopped = false;
    let connecting = false;
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
    let openedOnce = false;
    let ticketController: AbortController | null = null;
    let paused = false;

    const clearReconnectTimer = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (stopped || reconnectTimer || isHidden()) {
        return;
      }
      setState("reconnecting");
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, withJitter(reconnectDelay));
      reconnectDelay = nextReconnectDelay(reconnectDelay);
    };

    const handleChange = (event: MessageEvent<string>) => {
      if (parseAnalyticsChange(event.data)) {
        scheduler.change();
      }
    };

    const openSource = (ticket: string) => {
      const next = new EventSource(analyticsStreamUrl(apiBaseUrl, ticket));
      source = next;

      next.addEventListener("open", () => {
        reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
        setState("live");
        if (openedOnce) {
          scheduler.resync();
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
        scheduler.resync();
      });

      next.addEventListener("analytics.changed", handleChange as EventListener);
    };

    async function connect(): Promise<void> {
      if (stopped || connecting || source || isHidden()) {
        return;
      }
      connecting = true;
      setState(openedOnce ? "reconnecting" : "connecting");
      const controller = new AbortController();
      ticketController = controller;
      try {
        const authToken = (await getTokenRef.current()) || undefined;
        if (stopped || controller.signal.aborted) {
          return;
        }
        if (!authToken) {
          setState("offline");
          return;
        }
        const { ticket } = await fetchAnalyticsStreamTicket(
          apiBaseUrl,
          authToken,
          ticketScope,
          controller.signal,
        );
        if (!stopped && !controller.signal.aborted) {
          openSource(ticket);
        }
      } catch (err) {
        if (stopped || controller.signal.aborted) {
          return;
        }
        if (streamStateAfterFailure(failureStatus(err)) === "offline") {
          setState("offline");
          return;
        }
        scheduleReconnect();
      } finally {
        if (ticketController === controller) {
          ticketController = null;
          connecting = false;
        }
      }
    }

    const reconnectNow = () => {
      if (stopped || connecting || source || isHidden()) {
        return;
      }
      clearReconnectTimer();
      reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
      void connect();
    };

    const pause = () => {
      paused = true;
      scheduler.cancel();
      clearReconnectTimer();
      ticketController?.abort();
      ticketController = null;
      connecting = false;
      source?.close();
      source = null;
      setState("paused");
    };

    const handleVisibilityChange = () => {
      if (isHidden()) {
        pause();
        return;
      }
      if (paused) {
        paused = false;
        openedOnce = false;
        scheduler.reloadNow();
      }
      reconnectNow();
    };

    window.addEventListener("online", reconnectNow);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    if (isHidden()) {
      setState("paused");
    } else {
      void connect();
    }

    return () => {
      stopped = true;
      scheduler.cancel();
      clearReconnectTimer();
      ticketController?.abort();
      window.removeEventListener("online", reconnectNow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      source?.close();
      source = null;
    };
  }, [apiBaseUrl, enabled, identity, organizationId, projectId]);

  return state;
}

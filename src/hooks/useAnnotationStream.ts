import { useEffect, useRef, useState } from "react";
import type { StreamConnectionState, StreamEvent, StreamEventType } from "../types/stream.types";

const EVENT_TYPES: StreamEventType[] = [
  "annotation.created",
  "annotation.updated",
  "annotation.deleted",
  "comment.created",
  "comment.updated",
  "comment.deleted",
  "page-status.updated",
];

const RESYNC_COOLDOWN_MS = 5000;

function streamUrl(
  apiBaseUrl: string,
  projectId: string,
  pageKey: string,
  authToken: string | undefined,
): string {
  const base = apiBaseUrl.replace(/\/+$/, "");
  const url = new URL(`${base}/events`, window.location.origin);
  url.searchParams.set("projectId", projectId);
  url.searchParams.set("pageKey", pageKey);
  if (authToken) {
    url.searchParams.set("access_token", authToken);
  }
  return url.toString();
}

export interface AnnotationStreamOptions {
  apiBaseUrl: string;
  projectId: string;
  pageKey: string;
  authToken: string | undefined;
  enabled: boolean;
  onEvent: (event: StreamEvent) => void;
  onResync: () => void;
}

export function useAnnotationStream({
  apiBaseUrl,
  projectId,
  pageKey,
  authToken,
  enabled,
  onEvent,
  onResync,
}: AnnotationStreamOptions): StreamConnectionState {
  const [state, setState] = useState<StreamConnectionState>("closed");
  const onEventRef = useRef(onEvent);
  const onResyncRef = useRef(onResync);
  const lastResyncRef = useRef(0);
  onEventRef.current = onEvent;
  onResyncRef.current = onResync;

  const resync = () => {
    const now = Date.now();
    if (now - lastResyncRef.current < RESYNC_COOLDOWN_MS) {
      return;
    }
    lastResyncRef.current = now;
    onResyncRef.current();
  };

  useEffect(() => {
    if (
      !enabled ||
      !authToken ||
      typeof window === "undefined" ||
      typeof EventSource === "undefined"
    ) {
      setState("closed");
      return;
    }

    setState("connecting");
    const source = new EventSource(streamUrl(apiBaseUrl, projectId, pageKey, authToken));
    // A reconnect that replays from Last-Event-ID reopens the socket; only the
    // first open is a clean start, later ones follow a gap worth resyncing.
    let opened = false;

    const handleMessage = (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data) as StreamEvent;
        if (parsed.truncated) {
          resync();
          return;
        }
        onEventRef.current(parsed);
      } catch {
        resync();
      }
    };

    source.addEventListener("open", () => {
      setState("open");
      if (opened) {
        resync();
      }
      opened = true;
    });

    source.addEventListener("error", () => {
      setState(source.readyState === EventSource.CLOSED ? "closed" : "reconnecting");
    });

    source.addEventListener("replay-failed", () => {
      resync();
    });

    for (const type of EVENT_TYPES) {
      source.addEventListener(type, handleMessage as EventListener);
    }

    return () => {
      source.close();
      setState("closed");
    };
  }, [apiBaseUrl, authToken, enabled, pageKey, projectId]);

  return state;
}

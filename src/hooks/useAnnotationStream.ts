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

function streamUrl(apiBaseUrl: string, projectId: string, pageKey: string): string {
  const base = apiBaseUrl.replace(/\/+$/, "");
  const url = new URL(`${base}/events`, window.location.origin);
  url.searchParams.set("projectId", projectId);
  url.searchParams.set("pageKey", pageKey);
  return url.toString();
}

export interface AnnotationStreamOptions {
  apiBaseUrl: string;
  projectId: string;
  pageKey: string;
  enabled: boolean;
  onEvent: (event: StreamEvent) => void;
  onResync: () => void;
}

export function useAnnotationStream({
  apiBaseUrl,
  projectId,
  pageKey,
  enabled,
  onEvent,
  onResync,
}: AnnotationStreamOptions): StreamConnectionState {
  const [state, setState] = useState<StreamConnectionState>("closed");
  const onEventRef = useRef(onEvent);
  const onResyncRef = useRef(onResync);
  onEventRef.current = onEvent;
  onResyncRef.current = onResync;

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof EventSource === "undefined") {
      setState("closed");
      return;
    }

    setState("connecting");
    const source = new EventSource(streamUrl(apiBaseUrl, projectId, pageKey));
    // A reconnect that replays from Last-Event-ID reopens the socket; only the
    // first open is a clean start, later ones follow a gap worth resyncing.
    let opened = false;

    const handleMessage = (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data) as StreamEvent;
        if (parsed.truncated) {
          onResyncRef.current();
          return;
        }
        onEventRef.current(parsed);
      } catch {
        onResyncRef.current();
      }
    };

    source.addEventListener("open", () => {
      setState("open");
      if (opened) {
        onResyncRef.current();
      }
      opened = true;
    });

    source.addEventListener("error", () => {
      setState(source.readyState === EventSource.CLOSED ? "closed" : "reconnecting");
    });

    source.addEventListener("replay-failed", () => {
      onResyncRef.current();
    });

    for (const type of EVENT_TYPES) {
      source.addEventListener(type, handleMessage as EventListener);
    }

    return () => {
      source.close();
      setState("closed");
    };
  }, [apiBaseUrl, enabled, pageKey, projectId]);

  return state;
}

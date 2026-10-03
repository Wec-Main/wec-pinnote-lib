import { useCallback, useEffect, useState } from "react";
import { useOptionalAiRuntime } from "../../context/AiRuntimeContext";
import type { AiSession } from "../../types/ai.types";

const KEY_PREFIX = "wpn-ai-pinned-sessions:";

export function pinnedStorageKey(projectId: string | null | undefined): string {
  return `${KEY_PREFIX}${projectId ?? "none"}`;
}

export function readPinnedSessions(projectId: string | null | undefined): string[] {
  try {
    const raw = window.localStorage.getItem(pinnedStorageKey(projectId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function writePinnedSessions(projectId: string | null | undefined, ids: string[]): void {
  try {
    window.localStorage.setItem(pinnedStorageKey(projectId), JSON.stringify(ids));
  } catch {
    return;
  }
}

export function togglePinned(ids: readonly string[], aiSessionId: string): string[] {
  return ids.includes(aiSessionId) ? ids.filter((id) => id !== aiSessionId) : [...ids, aiSessionId];
}

export function pinnedFirst(
  sessions: readonly AiSession[],
  pinned: readonly string[],
): AiSession[] {
  if (pinned.length === 0) return [...sessions];
  const set = new Set(pinned);
  return [
    ...sessions.filter((session) => set.has(session.aiSessionId)),
    ...sessions.filter((session) => !set.has(session.aiSessionId)),
  ];
}

export interface AiPinnedSessions {
  pinned: readonly string[];
  isPinned: (aiSessionId: string) => boolean;
  toggle: (aiSessionId: string) => void;
}

export function useAiPinnedSessions(): AiPinnedSessions {
  const projectId = useOptionalAiRuntime()?.projectId;
  const [pinned, setPinned] = useState<string[]>([]);

  useEffect(() => {
    setPinned(readPinnedSessions(projectId));
  }, [projectId]);

  const toggle = useCallback(
    (aiSessionId: string) => {
      setPinned((current) => {
        const next = togglePinned(current, aiSessionId);
        writePinnedSessions(projectId, next);
        return next;
      });
    },
    [projectId],
  );

  const isPinned = useCallback((aiSessionId: string) => pinned.includes(aiSessionId), [pinned]);

  return { pinned, isPinned, toggle };
}

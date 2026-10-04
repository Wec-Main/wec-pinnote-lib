import { useCallback, useEffect, useRef, useState } from "react";
import { useOptionalAiRuntimeActions } from "../features/ai/AiRuntimeContext";
import { getAiActionHistory } from "../services/aiService";
import type { AiActionTarget, AiMessage } from "../types/ai.types";

const NO_MESSAGES: AiMessage[] = [];

export function useAiActionHistory(
  targetKind: AiActionTarget["kind"],
  targetId: string | null | undefined,
  options: { enabled?: boolean; refreshKey?: number; aiSessionId?: string | null } = {},
): { messages: AiMessage[]; loading: boolean; error: boolean; retry: () => void } {
  const runtime = useOptionalAiRuntimeActions();
  const { enabled = true, refreshKey = 0, aiSessionId = null } = options;
  const [messages, setMessages] = useState<AiMessage[]>(NO_MESSAGES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);
  const scopeRef = useRef("");
  const active = Boolean(runtime?.enabled && runtime.projectId && targetId && enabled);

  useEffect(() => {
    if (!active || !runtime || !targetId) {
      setMessages(NO_MESSAGES);
      return undefined;
    }
    const scope = `${targetKind}:${targetId}:${aiSessionId ?? ""}`;
    if (scopeRef.current !== scope) {
      scopeRef.current = scope;
      setMessages(NO_MESSAGES);
    }
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    runtime
      .getToken()
      .then((token) =>
        getAiActionHistory(
          runtime.apiBaseUrl,
          token,
          {
            projectId: runtime.projectId,
            targetKind,
            targetId,
            ...(aiSessionId ? { aiSessionId } : {}),
          },
          controller.signal,
        ),
      )
      .then((history) => {
        if (!controller.signal.aborted) setMessages(history.messages);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setMessages(NO_MESSAGES);
        setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [active, aiSessionId, runtime, targetKind, targetId, refreshKey, tick]);

  const retry = useCallback(() => setTick((value) => value + 1), []);

  return { messages: active ? messages : NO_MESSAGES, loading: active && loading, error, retry };
}

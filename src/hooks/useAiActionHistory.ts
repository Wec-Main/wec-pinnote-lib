import { useEffect, useState } from "react";
import { useOptionalAiRuntime } from "../context/AiRuntimeContext";
import { getAiActionHistory } from "../services/aiApi";
import type { AiActionTarget, AiMessage } from "../types/ai.types";

const NO_MESSAGES: AiMessage[] = [];

export function useAiActionHistory(
  targetKind: AiActionTarget["kind"],
  targetId: string | null | undefined,
  options: { enabled?: boolean; refreshKey?: number; aiSessionId?: string | null } = {},
): { messages: AiMessage[]; loading: boolean } {
  const runtime = useOptionalAiRuntime();
  const { enabled = true, refreshKey = 0, aiSessionId = null } = options;
  const [messages, setMessages] = useState<AiMessage[]>(NO_MESSAGES);
  const [loading, setLoading] = useState(false);
  const active = Boolean(runtime?.enabled && runtime.projectId && targetId && enabled);

  useEffect(() => {
    if (!active || !runtime || !targetId) {
      setMessages(NO_MESSAGES);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
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
        if (!controller.signal.aborted) setMessages(NO_MESSAGES);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [active, aiSessionId, runtime, targetKind, targetId, refreshKey]);

  return { messages: active ? messages : NO_MESSAGES, loading };
}

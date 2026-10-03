import { useCallback, useEffect, useState } from "react";
import { useOptionalAiRuntime } from "../context/AiRuntimeContext";
import { listAiActionChats, updateAiSession } from "../services/aiApi";
import type { AiActionTarget, AiSession } from "../types/ai.types";

const NO_CHATS: AiSession[] = [];

export interface AiActionChats {
  chats: AiSession[];
  loading: boolean;
  reload: () => void;
  rename: (aiSessionId: string, title: string) => Promise<void>;
  archive: (aiSessionId: string) => Promise<void>;
}

export function useAiActionChats(
  targetKind: AiActionTarget["kind"],
  targetId: string | null | undefined,
  enabled = true,
): AiActionChats {
  const runtime = useOptionalAiRuntime();
  const [chats, setChats] = useState<AiSession[]>(NO_CHATS);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const active = Boolean(runtime?.enabled && runtime.projectId && targetId && enabled);

  useEffect(() => {
    if (!active || !runtime || !targetId) {
      setChats(NO_CHATS);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    runtime
      .getToken()
      .then((token) =>
        listAiActionChats(
          runtime.apiBaseUrl,
          token,
          { projectId: runtime.projectId, targetKind, targetId },
          controller.signal,
        ),
      )
      .then((list) => {
        if (!controller.signal.aborted) setChats(list);
      })
      .catch(() => {
        if (!controller.signal.aborted) setChats(NO_CHATS);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [active, runtime, targetKind, targetId, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  const patch = useCallback(
    async (aiSessionId: string, input: { title?: string; archived?: boolean }) => {
      if (!runtime) return;
      const token = await runtime.getToken();
      await updateAiSession(runtime.apiBaseUrl, token, aiSessionId, input);
      setTick((value) => value + 1);
    },
    [runtime],
  );

  return {
    chats: active ? chats : NO_CHATS,
    loading,
    reload,
    rename: (aiSessionId, title) => patch(aiSessionId, { title }),
    archive: (aiSessionId) => patch(aiSessionId, { archived: true }),
  };
}

import { useEffect, useState } from "react";
import { useOptionalAiRuntime } from "../context/AiRuntimeContext";
import { fetchAiOpBatch } from "../services/aiApi";
import type { AiOpBatch } from "../types/ai.types";

export function useAiOpBatch(aiOpBatchId: string, skip: boolean): AiOpBatch | null {
  const runtime = useOptionalAiRuntime();
  const [fetched, setFetched] = useState<AiOpBatch | null>(null);
  const apiBaseUrl = runtime?.apiBaseUrl;
  const getToken = runtime?.getToken;

  useEffect(() => {
    if (skip || !apiBaseUrl || !getToken) return undefined;
    const controller = new AbortController();
    void (async () => {
      try {
        const batch = await fetchAiOpBatch(
          apiBaseUrl,
          await getToken(),
          aiOpBatchId,
          controller.signal,
        );
        if (!controller.signal.aborted) setFetched(batch);
      } catch {
        return;
      }
    })();
    return () => controller.abort();
  }, [aiOpBatchId, skip, apiBaseUrl, getToken]);

  return skip ? null : fetched;
}

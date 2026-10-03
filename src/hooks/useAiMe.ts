import { useAiRuntime } from "../context/AiRuntimeContext";
import type { AiMe } from "../types/ai.types";

export interface AiMeState {
  me: AiMe | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useAiMe(): AiMeState {
  const { me, meLoading, meError, refreshMe } = useAiRuntime();
  return { me, loading: meLoading, error: meError, refresh: refreshMe };
}

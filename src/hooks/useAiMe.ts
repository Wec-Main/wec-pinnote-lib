import { useAiRuntimeActions, useAiRuntimeState } from "../features/ai/AiRuntimeContext";
import type { AiMe } from "../types/ai.types";

export interface AiMeState {
  me: AiMe | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useAiMe(): AiMeState {
  const { refreshMe } = useAiRuntimeActions();
  const { me, meLoading, meError } = useAiRuntimeState();
  return { me, loading: meLoading, error: meError, refresh: refreshMe };
}

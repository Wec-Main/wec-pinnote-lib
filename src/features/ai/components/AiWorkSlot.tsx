import { createContext, useContext } from "react";

export const AiWorkSlotContext = createContext<HTMLElement | null>(null);

export function useAiWorkSlot(): HTMLElement | null {
  return useContext(AiWorkSlotContext);
}

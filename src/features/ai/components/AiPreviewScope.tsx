import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import { aiPreviewStore, type AiPreviewStore } from "../aiPreviewStore";
import type { AiOpBatchTargetKind } from "../../../types/ai.types";

export interface AiPreviewScopeValue {
  kind: AiOpBatchTargetKind;
  id: string;
  store?: AiPreviewStore;
}

export const AiPreviewScopeContext = createContext<AiPreviewScopeValue | null>(null);

export type AiPreviewMark = "added" | "changed" | "removed" | null;

export function useAiPreviewMark(kind: AiOpBatchTargetKind, itemId: string): AiPreviewMark {
  const scope = useContext(AiPreviewScopeContext);
  const store = scope?.store ?? aiPreviewStore;
  const targetId = scope && scope.kind === kind ? scope.id : null;
  const getSnapshot = useCallback((): AiPreviewMark => {
    if (!targetId) return null;
    const overlay = store.get(kind, targetId);
    if (!overlay) return null;
    if (overlay.added.has(itemId)) return "added";
    if (overlay.changed.has(itemId)) return "changed";
    if (overlay.removed.has(itemId)) return "removed";
    return null;
  }, [itemId, kind, store, targetId]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

export function aiMarkClass(mark: AiPreviewMark): string | false {
  return mark ? `wpn-ai-${mark}` : false;
}

export function useAiPreviewScope(): AiPreviewScopeValue | null {
  return useContext(AiPreviewScopeContext);
}

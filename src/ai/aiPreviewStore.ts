import { useCallback, useSyncExternalStore } from "react";
import type { ErdEntity, ErdRelationship } from "../types/dataModel.types";
import type { FlowEdge, FlowNode } from "../types/flowchart.types";
import type { AiOpBatchTargetKind } from "../types/ai.types";

export interface AiPreviewGhosts {
  entities: ErdEntity[];
  relationships: ErdRelationship[];
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface AiPreviewOverlay {
  aiOpBatchId: string;
  targetKind: AiOpBatchTargetKind;
  targetId: string;
  added: ReadonlySet<string>;
  changed: ReadonlySet<string>;
  removed: ReadonlySet<string>;
  ghosts: AiPreviewGhosts;
}

export type AiPreviewSnapshot = ReadonlyMap<string, AiPreviewOverlay>;

export const aiPreviewKey = (kind: AiOpBatchTargetKind, targetId: string): string =>
  `${kind}:${targetId}`;

export interface AiPreviewStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => AiPreviewSnapshot;
  get: (kind: AiOpBatchTargetKind, targetId: string) => AiPreviewOverlay | null;
  set: (overlay: AiPreviewOverlay) => void;
  clear: (kind: AiOpBatchTargetKind, targetId: string) => void;
}

export function createAiPreviewStore(): AiPreviewStore {
  let snapshot: AiPreviewSnapshot = new Map();
  const listeners = new Set<() => void>();
  const publish = (next: AiPreviewSnapshot) => {
    snapshot = next;
    for (const listener of [...listeners]) listener();
  };
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    get: (kind, targetId) => snapshot.get(aiPreviewKey(kind, targetId)) ?? null,
    set(overlay) {
      const next = new Map(snapshot);
      next.set(aiPreviewKey(overlay.targetKind, overlay.targetId), overlay);
      publish(next);
    },
    clear(kind, targetId) {
      const key = aiPreviewKey(kind, targetId);
      if (!snapshot.has(key)) return;
      const next = new Map(snapshot);
      next.delete(key);
      publish(next);
    },
  };
}

export const aiPreviewStore = createAiPreviewStore();

export function useAiPreview(
  kind: AiOpBatchTargetKind,
  targetId: string | null | undefined,
  store: AiPreviewStore = aiPreviewStore,
): AiPreviewOverlay | null {
  const getSnapshot = useCallback(
    () => (targetId ? store.get(kind, targetId) : null),
    [kind, store, targetId],
  );
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

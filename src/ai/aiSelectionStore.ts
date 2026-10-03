import { useEffect, useRef, useSyncExternalStore } from "react";
import type { AiSelection } from "../types/ai.types";

export interface AiCurrentSelection {
  selection: AiSelection;
  label: string;
}

type Listener = () => void;

const MAX_SELECTION_ITEMS = 2000;

let current: AiCurrentSelection | null = null;
const listeners = new Set<Listener>();

export const aiSelectionStore = {
  get(): AiCurrentSelection | null {
    return current;
  },
  set(next: AiCurrentSelection | null): void {
    if (next && next.selection.itemIds.length === 0) next = null;
    if (current === next) return;
    current = next;
    for (const listener of [...listeners]) listener();
  },
  clear(): void {
    aiSelectionStore.set(null);
  },
  clearFor(kind: AiSelection["kind"], id: string): void {
    if (current && current.selection.kind === kind && current.selection.id === id) {
      aiSelectionStore.set(null);
    }
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useAiCurrentSelection(): AiCurrentSelection | null {
  return useSyncExternalStore(aiSelectionStore.subscribe, aiSelectionStore.get, () => null);
}

export function aiSelectionLabel(
  names: readonly string[],
  noun: readonly [string, string],
): string {
  if (names.length === 1 && names[0]) return names[0];
  return `${names.length} ${names.length === 1 ? noun[0] : noun[1]}`;
}

export function usePublishAiSelection(
  kind: AiSelection["kind"],
  id: string,
  itemIds: ReadonlySet<string>,
  label: (ids: string[]) => string,
): void {
  const labelRef = useRef(label);
  labelRef.current = label;

  useEffect(() => {
    const ids = [...itemIds].slice(0, MAX_SELECTION_ITEMS);
    if (ids.length === 0) {
      aiSelectionStore.clearFor(kind, id);
      return;
    }
    aiSelectionStore.set({ selection: { kind, id, itemIds: ids }, label: labelRef.current(ids) });
  }, [id, itemIds, kind]);

  useEffect(() => () => aiSelectionStore.clearFor(kind, id), [id, kind]);
}

import { useSyncExternalStore } from 'react';
import type { FlowEngine } from '../../core/FlowEngine';

/** Local, non-persisted signal for which node should open in inline label-edit mode. */
const editStore = (() => {
  let current: string | null = null;
  const listeners = new Set<() => void>();
  const set = (id: string | null) => {
    if (current === id) return;
    current = id;
    listeners.forEach((l) => l());
  };
  return {
    set,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => current,
  };
})();

export function useNodeEditTarget(): [string | null, (id: string | null) => void] {
  const id = useSyncExternalStore(editStore.subscribe, editStore.getSnapshot, editStore.getSnapshot);
  return [id, editStore.set];
}

/** Opens every freshly created node in inline edit mode as soon as it appears on the canvas. */
export function watchNodeCreationForInlineEdit(engine: FlowEngine): () => void {
  return engine.on('operation', (op) => {
    if (op.type === 'addNode') editStore.set(op.node.id);
  });
}

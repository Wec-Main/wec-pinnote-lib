import { useCallback, useRef, useState } from "react";

export interface UseFlowHistoryOptions {
  /** Maximum number of past entries retained before the oldest are dropped. Default 50. */
  maxSize?: number;
}

export interface UseFlowHistoryResult<T> {
  present: T;
  /** Pushes `next` as a new committed history entry and makes it the present state; truncates any redo stack. */
  commit: (next: T) => void;
  /** Updates the CURRENT entry in place without creating a new history entry (for transient/live updates). */
  replacePresent: (next: T) => void;
  /** Moves to the previous committed entry. No-op if `canUndo` is false. */
  undo: () => void;
  /** Moves to the next (previously undone) entry. No-op if `canRedo` is false. */
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Clears all history and sets `state` as the sole present entry. */
  reset: (state: T) => void;
}

const DEFAULT_MAX_SIZE = 50;

/**
 * Plain, framework-free undo/redo stack. Kept separate from the React hook so
 * the core logic can be unit-tested directly without rendering React.
 */
export class HistoryStore<T> {
  private past: T[] = [];
  private current: T;
  private future: T[] = [];
  private readonly maxSize: number;

  constructor(initialState: T, maxSize: number = DEFAULT_MAX_SIZE) {
    this.current = initialState;
    this.maxSize = maxSize > 0 ? maxSize : DEFAULT_MAX_SIZE;
  }

  get present(): T {
    return this.current;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  commit(next: T): void {
    this.past.push(this.current);
    if (this.past.length > this.maxSize) {
      this.past.splice(0, this.past.length - this.maxSize);
    }
    this.current = next;
    this.future = [];
  }

  replacePresent(next: T): void {
    this.current = next;
  }

  undo(): void {
    if (!this.canUndo) {
      return;
    }
    const previous = this.past.pop() as T;
    this.future.push(this.current);
    this.current = previous;
  }

  redo(): void {
    if (!this.canRedo) {
      return;
    }
    const next = this.future.pop() as T;
    this.past.push(this.current);
    if (this.past.length > this.maxSize) {
      this.past.splice(0, this.past.length - this.maxSize);
    }
    this.current = next;
  }

  reset(state: T): void {
    this.past = [];
    this.future = [];
    this.current = state;
  }
}

/**
 * Generic, bounded undo/redo history hook. Fully generic and reusable - has
 * no dependency on any flow-specific types.
 */
export function useFlowHistory<T>(
  initialState: T,
  options?: UseFlowHistoryOptions
): UseFlowHistoryResult<T> {
  const maxSize = options?.maxSize ?? DEFAULT_MAX_SIZE;

  const storeRef = useRef<HistoryStore<T> | null>(null);
  if (storeRef.current === null) {
    storeRef.current = new HistoryStore<T>(initialState, maxSize);
  }
  const store = storeRef.current;

  // Bump a counter to force a re-render whenever the store's internal state changes.
  const [, forceRender] = useState(0);
  const rerender = useCallback(() => {
    forceRender((tick) => tick + 1);
  }, []);

  const commit = useCallback(
    (next: T) => {
      store.commit(next);
      rerender();
    },
    [store, rerender]
  );

  const replacePresent = useCallback(
    (next: T) => {
      store.replacePresent(next);
      rerender();
    },
    [store, rerender]
  );

  const undo = useCallback(() => {
    if (!store.canUndo) {
      return;
    }
    store.undo();
    rerender();
  }, [store, rerender]);

  const redo = useCallback(() => {
    if (!store.canRedo) {
      return;
    }
    store.redo();
    rerender();
  }, [store, rerender]);

  const reset = useCallback(
    (state: T) => {
      store.reset(state);
      rerender();
    },
    [store, rerender]
  );

  return {
    present: store.present,
    commit,
    replacePresent,
    undo,
    redo,
    canUndo: store.canUndo,
    canRedo: store.canRedo,
    reset,
  };
}

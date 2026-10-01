import { useRef, useSyncExternalStore } from "react";
import type { Store } from "../utils/flowchart/store";

export function useStoreSelector<S extends object, T>(
  store: Store<S>,
  selector: (state: S) => T,
  equalityFn: (a: T, b: T) => boolean = Object.is,
): T {
  const cache = useRef<{ value: T } | null>(null);
  const getSnapshot = () => {
    const next = selector(store.getState());
    if (cache.current && equalityFn(cache.current.value, next)) return cache.current.value;
    cache.current = { value: next };
    return next;
  };
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

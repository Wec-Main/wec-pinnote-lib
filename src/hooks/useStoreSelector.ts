import { useRef, useSyncExternalStore } from "react";
import type { Store } from "../utils/flowchart/store";

const isDev = typeof process !== "undefined" && process.env.NODE_ENV !== "production";

export function useStoreSelector<S extends object, T>(
  store: Store<S>,
  selector: (state: S) => T,
  equalityFn: (a: T, b: T) => boolean = Object.is,
): T {
  const cache = useRef<{ state: S; value: T } | null>(null);
  const warnedRef = useRef(false);
  const getSnapshot = () => {
    const state = store.getState();
    const next = selector(state);
    if (cache.current) {
      if (equalityFn(cache.current.value, next)) return cache.current.value;
      // The underlying store state didn't change (same reference as last
      // time) but the selector still produced a new value by this
      // equality function — almost always because it returns a freshly
      // computed array/object literal and no shallow-equality function was
      // passed in, which defeats this hook's cache and causes an extra
      // re-render on every unrelated store update. Pass a shallow-equality
      // function (e.g. `shallowEqual`) for selectors like this.
      if (
        isDev &&
        !warnedRef.current &&
        cache.current.state === state &&
        typeof next === "object" &&
        next !== null
      ) {
        warnedRef.current = true;
        console.warn(
          "useStoreSelector: selector returned a new reference from unchanged state. " +
            "This defeats the cache and causes unnecessary re-renders — pass a shallow-equality " +
            "function as the third argument for selectors that compute arrays/objects.",
        );
      }
    }
    cache.current = { state, value: next };
    return next;
  };
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

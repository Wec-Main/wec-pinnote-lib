export type Listener = () => void;

/**
 * Minimal observable state container. React subscribes to it through
 * `useSyncExternalStore` with selectors, so components only re-render when
 * the slice they select actually changes.
 */
export class Store<S extends object> {
  private state: S;
  private readonly listeners = new Set<Listener>();

  constructor(initial: S) {
    this.state = initial;
  }

  getState = (): S => this.state;

  setState = (patch: Partial<S> | ((s: S) => Partial<S>)): void => {
    const next = typeof patch === "function" ? patch(this.state) : patch;
    let changed = false;
    for (const key in next) {
      if (!Object.is(next[key], this.state[key])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...next };
    this.listeners.forEach((l) => l());
  };

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}

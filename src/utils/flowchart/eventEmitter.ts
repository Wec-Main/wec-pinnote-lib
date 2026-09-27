type Handler<T> = (payload: T) => void;

export class EventEmitter<Events extends Record<string, unknown>> {
  private handlers: { [K in keyof Events]?: Set<Handler<Events[K]>> } = {};

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    (this.handlers[event] ??= new Set()).add(handler);
    return () => this.off(event, handler);
  }

  off<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    this.handlers[event]?.delete(handler);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const handlers = this.handlers[event];
    if (!handlers) return;

    for (const handler of [...handlers]) {
      if (handlers.has(handler)) handler(payload);
    }
  }

  clear(): void {
    this.handlers = {};
  }
}

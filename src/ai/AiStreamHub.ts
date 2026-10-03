import type { AiStreamEvent } from "../types/ai.types";

export type AiStreamListener = (event: AiStreamEvent) => void;
export type AiReconnectListener = () => void;

export class AiStreamHub {
  private readonly listeners = new Set<AiStreamListener>();
  private readonly reconnectListeners = new Set<AiReconnectListener>();

  subscribe(listener: AiStreamListener, onReconnect?: AiReconnectListener): () => void {
    this.listeners.add(listener);
    if (onReconnect) this.reconnectListeners.add(onReconnect);
    return () => {
      this.listeners.delete(listener);
      if (onReconnect) this.reconnectListeners.delete(onReconnect);
    };
  }

  emit = (event: AiStreamEvent): void => {
    for (const listener of [...this.listeners]) listener(event);
  };

  reconnected = (): void => {
    for (const listener of [...this.reconnectListeners]) listener();
  };

  get size(): number {
    return this.listeners.size;
  }
}

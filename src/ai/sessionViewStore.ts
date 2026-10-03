import { useSyncExternalStore } from "react";
import {
  reduceDraft,
  reduceSessionView,
  sessionOfEvent,
  type AiSessionViewState,
  type AiStreamingDraft,
} from "./sessionReducer";
import type { AiStreamEvent } from "../types/ai.types";

type DeltaEvent = Extract<AiStreamEvent, { type: "ai_delta" }>;

export interface AiDraftStore {
  getDraft: () => AiStreamingDraft | null;
  subscribe: (listener: () => void) => () => void;
}

export const EMPTY_DRAFT_STORE: AiDraftStore = {
  getDraft: () => null,
  subscribe: () => () => undefined,
};

export function staticDraftStore(draft: AiStreamingDraft | null): AiDraftStore {
  return { getDraft: () => draft, subscribe: () => () => undefined };
}

const coarseDraftKey = (draft: AiStreamingDraft | null): string =>
  draft
    ? `${draft.aiTurnId}|${draft.status}|${draft.stale ? 1 : 0}|${draft.maybeMissed ? 1 : 0}`
    : "";

type Scheduler = { request: (run: () => void) => unknown; cancel: (handle: unknown) => void };

const frameScheduler: Scheduler = {
  request: (run) =>
    typeof requestAnimationFrame === "function" ? requestAnimationFrame(run) : setTimeout(run, 16),
  cancel: (handle) => {
    if (typeof cancelAnimationFrame === "function" && typeof handle === "number") {
      cancelAnimationFrame(handle);
    } else {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    }
  },
};

export class AiSessionViewStore implements AiDraftStore {
  private full: AiSessionViewState;
  private coarse: AiSessionViewState;
  private coarseKey: string;
  private buffer: DeltaEvent[] = [];
  private frame: unknown = null;
  private readonly viewListeners = new Set<() => void>();
  private readonly draftListeners = new Set<() => void>();

  constructor(
    initial: AiSessionViewState,
    private readonly aiSessionId: string | null,
    private readonly scheduler: Scheduler = frameScheduler,
  ) {
    this.full = initial;
    this.coarse = initial;
    this.coarseKey = coarseDraftKey(initial.draft);
  }

  getView = (): AiSessionViewState => this.coarse;

  getDraft = (): AiStreamingDraft | null => this.full.draft;

  subscribeView = (listener: () => void): (() => void) => {
    this.viewListeners.add(listener);
    return () => this.viewListeners.delete(listener);
  };

  subscribe = (listener: () => void): (() => void) => {
    this.draftListeners.add(listener);
    return () => this.draftListeners.delete(listener);
  };

  get pendingDeltas(): number {
    return this.buffer.length;
  }

  dispatch(event: AiStreamEvent): void {
    if (this.aiSessionId === null) return;
    if (event.type === "ai_delta") {
      if (event.aiSessionId !== this.aiSessionId) return;
      this.buffer.push(event);
      if (this.frame === null) {
        this.frame = this.scheduler.request(() => {
          this.frame = null;
          this.flush();
        });
      }
      return;
    }
    this.flush();
    if (sessionOfEvent(event) !== this.aiSessionId) return;
    this.commit(reduceSessionView(this.full, this.aiSessionId, event));
  }

  update(change: (state: AiSessionViewState) => AiSessionViewState): void {
    this.flush();
    this.commit(change(this.full));
  }

  flush(): void {
    if (this.frame !== null) {
      this.scheduler.cancel(this.frame);
      this.frame = null;
    }
    if (this.buffer.length === 0) return;
    const deltas = this.buffer;
    this.buffer = [];
    let draft = this.full.draft;
    for (const delta of deltas) draft = reduceDraft(draft, delta);
    if (draft === this.full.draft) return;
    this.commit({ ...this.full, draft });
  }

  dispose(): void {
    this.flush();
    this.viewListeners.clear();
    this.draftListeners.clear();
  }

  private commit(next: AiSessionViewState): void {
    const previous = this.full;
    if (next === previous) return;
    this.full = next;
    if (next.draft !== previous.draft) {
      for (const listener of [...this.draftListeners]) listener();
    }
    const key = coarseDraftKey(next.draft);
    const structural =
      next.meta !== previous.meta ||
      next.messages !== previous.messages ||
      next.turns !== previous.turns ||
      next.deleted !== previous.deleted;
    if (structural || key !== this.coarseKey) {
      this.coarseKey = key;
      this.coarse = next;
      for (const listener of [...this.viewListeners]) listener();
    }
  }
}

export function useAiDraft(store: AiDraftStore): AiStreamingDraft | null {
  return useSyncExternalStore(store.subscribe, store.getDraft, store.getDraft);
}

import type { AiOpBatch, AiOpBatchTargetKind } from "../../types/ai.types";

type Listener = () => void;

const pending = new Map<string, AiOpBatch>();
const listeners = new Set<Listener>();
const myTurnIds = new Set<string>();

const keyOf = (kind: AiOpBatchTargetKind, targetId: string) => `${kind}:${targetId}`;

function emit() {
  for (const listener of [...listeners]) listener();
}

export const aiEditorRequests = {
  requestPreview(batch: AiOpBatch): void {
    pending.set(keyOf(batch.targetKind, batch.targetId), batch);
    emit();
  },
  take(kind: AiOpBatchTargetKind, targetId: string): AiOpBatch | null {
    const key = keyOf(kind, targetId);
    const batch = pending.get(key) ?? null;
    if (batch) pending.delete(key);
    return batch;
  },
  peek(kind: AiOpBatchTargetKind, targetId: string): AiOpBatch | null {
    return pending.get(keyOf(kind, targetId)) ?? null;
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  rememberTurn(aiTurnId: string): void {
    myTurnIds.add(aiTurnId);
  },
  isMyTurn(aiTurnId: string | null): boolean {
    return aiTurnId !== null && myTurnIds.has(aiTurnId);
  },
  reset(): void {
    pending.clear();
    myTurnIds.clear();
  },
};

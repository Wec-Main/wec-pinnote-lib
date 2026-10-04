import { aiErrorCode } from "./components/aiHelpers";
import type { AiOpBatch, UpdateAiOpBatchRequest } from "../../types/ai.types";

export const OP_BATCH_STATUS_CONFLICT = "op_batch_status_conflict";

export type StatusConflictOutcome =
  | { kind: "settled"; batch: AiOpBatch }
  | { kind: "diverged"; batch: AiOpBatch }
  | { kind: "unknown" };

export function isOpBatchStatusConflict(err: unknown): boolean {
  return aiErrorCode(err) === OP_BATCH_STATUS_CONFLICT;
}

export async function reconcileStatusConflict(
  input: UpdateAiOpBatchRequest,
  fetchBatch: () => Promise<AiOpBatch>,
): Promise<StatusConflictOutcome> {
  try {
    const batch = await fetchBatch();
    return batch.status === input.status ? { kind: "settled", batch } : { kind: "diverged", batch };
  } catch {
    return { kind: "unknown" };
  }
}

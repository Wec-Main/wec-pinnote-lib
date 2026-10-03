import { AI_ERD_LIMITS } from "./limits";
import { parseOps } from "./parseOps";
import { ERD_OP_SPECS } from "./schemas";
import type { ErdOp, ParseOpsResult } from "./types";

export function parseErdOps(raw: unknown): ParseOpsResult<ErdOp> {
  return parseOps<ErdOp>(raw, ERD_OP_SPECS, AI_ERD_LIMITS.maxOpsPerBatch);
}

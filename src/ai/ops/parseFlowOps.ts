import { AI_FLOW_LIMITS } from "./limits";
import { parseOps } from "./parseOps";
import { FLOW_OP_SPECS } from "./schemas";
import type { FlowOp, ParseOpsResult } from "./types";

export function parseFlowOps(raw: unknown): ParseOpsResult<FlowOp> {
  return parseOps<FlowOp>(raw, FLOW_OP_SPECS, AI_FLOW_LIMITS.maxOpsPerBatch);
}

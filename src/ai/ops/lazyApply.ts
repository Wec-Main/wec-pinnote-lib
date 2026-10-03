import type { ErdDocumentJSON } from "../../types/dataModel.types";
import type { FlowJSON } from "../../types/flowchart.types";
import type { ApplyFlowOpsOptions, ApplyOpsOptions, ApplyOpsResult, ErdOp, FlowOp } from "./types";

export async function applyErdOps(
  input: ErdDocumentJSON,
  ops: readonly ErdOp[],
  options?: ApplyOpsOptions,
): Promise<ApplyOpsResult<ErdDocumentJSON>> {
  const module = await import("./applyErdOps");
  return module.applyErdOps(input, ops, options);
}

export async function applyFlowOps(
  input: FlowJSON,
  ops: readonly FlowOp[],
  options?: ApplyFlowOpsOptions,
): Promise<ApplyOpsResult<FlowJSON>> {
  const module = await import("./applyFlowOps");
  return module.applyFlowOps(input, ops, options);
}

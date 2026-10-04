import type { ErdDocumentJSON } from "../../../types/dataModel.types";
import type { FlowJSON } from "../../../types/flowchart.types";
import type * as ErdOpsModule from "./applyErdOps";
import type * as FlowOpsModule from "./applyFlowOps";
import type { ErdDraft, ErdDraftStep } from "./applyErdOps";
import type { ApplyFlowOpsOptions, ApplyOpsOptions, ApplyOpsResult, ErdOp, FlowOp } from "./types";

let erdModule: Promise<typeof ErdOpsModule> | null = null;
let flowModule: Promise<typeof FlowOpsModule> | null = null;

export function loadErdOps(): Promise<typeof ErdOpsModule> {
  erdModule ??= import("./applyErdOps").catch((err: unknown) => {
    erdModule = null;
    throw err;
  });
  return erdModule;
}

export function loadFlowOps(): Promise<typeof FlowOpsModule> {
  flowModule ??= import("./applyFlowOps").catch((err: unknown) => {
    flowModule = null;
    throw err;
  });
  return flowModule;
}

export async function applyErdOps(
  input: ErdDocumentJSON,
  ops: readonly ErdOp[],
  options?: ApplyOpsOptions,
): Promise<ApplyOpsResult<ErdDocumentJSON>> {
  const module = await loadErdOps();
  return module.applyErdOps(input, ops, options);
}

export async function applyFlowOps(
  input: FlowJSON,
  ops: readonly FlowOp[],
  options?: ApplyFlowOpsOptions,
): Promise<ApplyOpsResult<FlowJSON>> {
  const module = await loadFlowOps();
  return module.applyFlowOps(input, ops, options);
}

export async function startErdDraft(input: ErdDocumentJSON): Promise<ErdDraft> {
  const module = await loadErdOps();
  return module.startErdDraft(input);
}

export async function applyErdDraftOps(
  draft: ErdDraft,
  ops: readonly ErdOp[],
  options?: ApplyOpsOptions,
): Promise<ErdDraftStep> {
  const module = await loadErdOps();
  return module.applyErdDraftOps(draft, ops, options);
}

export async function finishErdDraft(draft: ErdDraft): Promise<ApplyOpsResult<ErdDocumentJSON>> {
  const module = await loadErdOps();
  return module.finishErdDraft(draft);
}

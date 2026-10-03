import { applyErdOps } from "./ops/applyErdOps";
import { applyFlowOps } from "./ops/applyFlowOps";
import type { DocDiff, ErdOp, FlowOp, OpError } from "./ops/types";
import type { AiPreviewOverlay } from "./aiPreviewStore";
import type { AiOpBatch, AiOpBatchStatus, AiOpBatchTargetKind } from "../types/ai.types";
import type { ErdDocumentJSON } from "../types/dataModel.types";
import type { FlowJSON } from "../types/flowchart.types";

const TRANSITIONS: Readonly<Record<AiOpBatchStatus, readonly AiOpBatchStatus[]>> = {
  proposed: ["applied", "rejected", "conflict", "discarded"],
  applied: ["saved", "discarded", "rejected", "conflict"],
  conflict: ["applied", "discarded"],
  saved: [],
  rejected: [],
  discarded: [],
};

export function canTransitionOpBatch(from: AiOpBatchStatus, to: AiOpBatchStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export type BatchApplication<D> =
  | {
      ok: true;
      document: D;
      diff: DocDiff;
      idMap: Record<string, string>;
      warnings: string[];
      skipped: string[];
    }
  | { ok: false; errors: OpError[]; detail: string };

const MAX_SKIP_ROUNDS = 12;

export function describeOpErrors(errors: readonly OpError[]): string {
  return errors
    .map((error) =>
      error.index >= 0 ? `#${error.index} ${error.op}: ${error.message}` : error.message,
    )
    .join("\n");
}

export function applyBatchToDocument(
  batch: AiOpBatch,
  current: ErdDocumentJSON | FlowJSON,
): BatchApplication<ErdDocumentJSON | FlowJSON> {
  const run = (list: unknown[]) =>
    batch.targetKind === "data_model"
      ? applyErdOps(current as ErdDocumentJSON, list as ErdOp[])
      : applyFlowOps(current as FlowJSON, list as FlowOp[]);
  let ops: unknown[] = [...batch.ops];
  let origin = ops.map((_, index) => index);
  const skipped: string[] = [];
  let firstErrors: OpError[] | null = null;
  for (let round = 0; round <= MAX_SKIP_ROUNDS; round++) {
    const result = run(ops);
    if (result.ok) {
      return {
        ok: true,
        document: result.document,
        diff: result.diff,
        idMap: result.idMap,
        warnings: result.warnings,
        skipped,
      };
    }
    firstErrors ??= result.errors;
    const failing = new Set(
      result.errors.filter((error) => error.index >= 0).map((error) => error.index),
    );
    const global = result.errors.some((error) => error.index < 0);
    if (failing.size === 0 || global) break;
    for (const index of failing) {
      const error = result.errors.find((item) => item.index === index);
      if (error) skipped.push(`#${origin[index]} ${error.op}: ${error.message}`);
    }
    const keep = ops.map((_, index) => !failing.has(index));
    ops = ops.filter((_, index) => keep[index]);
    origin = origin.filter((_, index) => keep[index]);
    if (ops.length === 0) break;
  }
  const errors = firstErrors ?? [];
  return { ok: false, errors, detail: describeOpErrors(errors) };
}

const DRAFT_ATTEMPTS = 4;

function draftIds(): (prefix: string) => string {
  let n = 0;
  return (prefix) => `${prefix}_draft_${++n}`;
}

export function applyPartialOps(
  kind: AiOpBatchTargetKind,
  current: ErdDocumentJSON | FlowJSON,
  ops: readonly unknown[],
): { document: ErdDocumentJSON | FlowJSON; diff: DocDiff } | null {
  let pending = ops.filter((op) => typeof op === "object" && op !== null);
  for (let attempt = 0; attempt < DRAFT_ATTEMPTS && pending.length > 0; attempt++) {
    const result =
      kind === "data_model"
        ? applyErdOps(current as ErdDocumentJSON, pending as ErdOp[], { createId: draftIds() })
        : applyFlowOps(current as FlowJSON, pending as FlowOp[], { createId: draftIds() });
    if (result.ok) return { document: result.document, diff: result.diff };
    const bad = new Set(result.errors.map((error) => error.index).filter((index) => index >= 0));
    if (bad.size === 0) return null;
    pending = pending.filter((_, index) => !bad.has(index));
  }
  return null;
}

export function buildPreviewOverlay(
  batch: Pick<AiOpBatch, "aiOpBatchId" | "targetKind" | "targetId">,
  before: ErdDocumentJSON | FlowJSON,
  diff: DocDiff,
): AiPreviewOverlay {
  const removed = new Set(diff.removed);
  const erd = batch.targetKind === "data_model" ? (before as ErdDocumentJSON) : null;
  const flow = batch.targetKind === "flow" ? (before as FlowJSON) : null;
  return {
    aiOpBatchId: batch.aiOpBatchId,
    targetKind: batch.targetKind,
    targetId: batch.targetId,
    added: new Set(diff.added),
    changed: new Set(diff.changed),
    removed,
    ghosts: {
      entities: erd?.entities.filter((entity) => removed.has(entity.id)) ?? [],
      relationships: erd?.relationships.filter((rel) => removed.has(rel.id)) ?? [],
      nodes: flow?.nodes.filter((node) => removed.has(node.id)) ?? [],
      edges: flow?.edges.filter((edge) => removed.has(edge.id)) ?? [],
    },
  };
}

export interface AppliedBatches {
  previewing: string | null;
  applied: readonly string[];
}

export const NO_APPLIED_BATCHES: AppliedBatches = { previewing: null, applied: [] };

export function withPreview(state: AppliedBatches, aiOpBatchId: string): AppliedBatches {
  return {
    previewing: aiOpBatchId,
    applied: state.applied.includes(aiOpBatchId) ? state.applied : [...state.applied, aiOpBatchId],
  };
}

export function withAccepted(state: AppliedBatches): AppliedBatches {
  return state.previewing === null ? state : { ...state, previewing: null };
}

export function withRejected(state: AppliedBatches, aiOpBatchId: string): AppliedBatches {
  return {
    previewing: state.previewing === aiOpBatchId ? null : state.previewing,
    applied: state.applied.filter((id) => id !== aiOpBatchId),
  };
}

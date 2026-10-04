import { loadErdOps, loadFlowOps } from "./ops/lazyApply";
import { jsonEqual } from "./ops/refs";
import { getOpKind } from "./ops/registry";
import type { ApplyOpsResult, DocDiff, ErdOp, FlowOp, OpError } from "./ops/types";
import type { AiPreviewOverlay } from "./aiPreviewStore";
import type { AiOpBatch, AiOpBatchStatus, AiOpBatchTargetKind } from "../../types/ai.types";
import type { ErdDocumentJSON } from "../../types/dataModel.types";
import type { FlowJSON } from "../../types/flowchart.types";

const TRANSITIONS: Readonly<Record<AiOpBatchStatus, readonly AiOpBatchStatus[]>> = {
  proposed: ["applying", "applied", "rejected", "conflict", "discarded"],
  applying: ["proposed", "applied", "rejected", "conflict", "discarded"],
  applied: ["saved", "discarded", "rejected", "conflict"],
  conflict: ["applying", "applied", "discarded"],
  saved: [],
  rejected: [],
  discarded: [],
};

export function canTransitionOpBatch(from: AiOpBatchStatus, to: AiOpBatchStatus): boolean {
  return (TRANSITIONS[from] as readonly AiOpBatchStatus[] | undefined)?.includes(to) ?? false;
}

export function isBusyOpBatchStatus(status: AiOpBatchStatus | string): boolean {
  return status === "applying";
}

type OpsRunner<D, O> = (
  doc: D,
  ops: readonly O[],
  options?: { createId?: (prefix: string) => string },
) => ApplyOpsResult<D>;

export function loadErdOpsRunner(): Promise<OpsRunner<ErdDocumentJSON, ErdOp>> {
  return loadErdOps().then((module) => module.applyErdOps);
}

export function loadFlowOpsRunner(): Promise<OpsRunner<FlowJSON, FlowOp>> {
  return loadFlowOps().then((module) => module.applyFlowOps);
}

export function prefetchOpsRunners(): void {
  void loadErdOpsRunner().catch(() => undefined);
  void loadFlowOpsRunner().catch(() => undefined);
}

export function filterBatchOps(batch: AiOpBatch, excluded: ReadonlySet<number>): AiOpBatch {
  if (excluded.size === 0) return batch;
  return { ...batch, ops: batch.ops.filter((_, index) => !excluded.has(index)) } as AiOpBatch;
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

export async function applyBatchToDocument(
  batch: AiOpBatch,
  current: ErdDocumentJSON | FlowJSON,
): Promise<BatchApplication<ErdDocumentJSON | FlowJSON>> {
  const plugin = getOpKind(batch.targetKind);
  if (!plugin) {
    return { ok: false, errors: [], detail: `Unsupported target kind "${batch.targetKind}"` };
  }
  let ops: unknown[] = [...batch.ops];
  let origin = ops.map((_, index) => index);
  const skipped: string[] = [];
  let firstErrors: OpError[] | null = null;
  for (let round = 0; round <= MAX_SKIP_ROUNDS; round++) {
    const result = await plugin.apply(current, ops);
    if (result.ok) {
      return {
        ok: true,
        document: result.document as ErdDocumentJSON | FlowJSON,
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

export interface DraftIds {
  next: number;
}

export function draftIds(state: DraftIds = { next: 0 }): (prefix: string) => string {
  return (prefix) => `${prefix}_draft_${++state.next}`;
}

export async function applyPartialOps(
  kind: AiOpBatchTargetKind,
  current: ErdDocumentJSON | FlowJSON,
  ops: readonly unknown[],
  ids: DraftIds = { next: 0 },
): Promise<{ document: ErdDocumentJSON | FlowJSON; diff: DocDiff } | null> {
  const plugin = getOpKind(kind);
  if (!plugin) return null;
  let pending = ops.filter((op) => typeof op === "object" && op !== null);
  for (let attempt = 0; attempt < DRAFT_ATTEMPTS && pending.length > 0; attempt++) {
    const start = ids.next;
    const createId = draftIds(ids);
    const result = await plugin.apply(current, pending, { createId });
    if (result.ok) {
      return { document: result.document as ErdDocumentJSON | FlowJSON, diff: result.diff };
    }
    ids.next = start;
    const bad = new Set(result.errors.map((error) => error.index).filter((index) => index >= 0));
    if (bad.size === 0) return null;
    pending = pending.filter((_, index) => !bad.has(index));
  }
  return null;
}

export type DraftPlan = { mode: "full" } | { mode: "suffix"; from: number };

export const DRAFT_COMPACT_STEPS = 8;

const referencesTemp = (op: unknown): boolean => JSON.stringify(op).includes('"$');

export function planDraftStep(
  applied: readonly unknown[],
  next: readonly unknown[],
  steps: number,
): DraftPlan {
  if (applied.length === 0 || next.length <= applied.length || steps >= DRAFT_COMPACT_STEPS) {
    return { mode: "full" };
  }
  for (let index = 0; index < applied.length; index++) {
    if (applied[index] !== next[index]) return { mode: "full" };
  }
  for (let index = applied.length; index < next.length; index++) {
    const op = next[index];
    if (typeof op !== "object" || op === null || referencesTemp(op)) return { mode: "full" };
  }
  return { mode: "suffix", from: applied.length };
}

export function mergeDocDiffs(base: DocDiff, next: DocDiff): DocDiff {
  const added = new Set(base.added);
  const changed = new Set(base.changed);
  const removed = new Set(base.removed);
  for (const id of next.added) {
    if (removed.has(id)) {
      removed.delete(id);
      changed.add(id);
    } else added.add(id);
  }
  for (const id of next.changed) if (!added.has(id)) changed.add(id);
  for (const id of next.removed) {
    if (added.has(id)) added.delete(id);
    else {
      changed.delete(id);
      removed.add(id);
    }
  }
  return { added: [...added], changed: [...changed], removed: [...removed] };
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

export interface DraftSession {
  kind: AiOpBatchTargetKind;
  state: unknown;
  before: ErdDocumentJSON | FlowJSON;
  document: ErdDocumentJSON | FlowJSON;
  applied: readonly unknown[];
  skipped: readonly string[];
  diff: DocDiff;
}

export function supportsDraftSession(kind: AiOpBatchTargetKind): boolean {
  return Boolean(getOpKind(kind)?.draft);
}

export async function startDraftSession(
  kind: AiOpBatchTargetKind,
  before: ErdDocumentJSON | FlowJSON,
): Promise<DraftSession | null> {
  const kit = getOpKind(kind)?.draft;
  if (!kit) return null;
  const state = await kit.start(before);
  return {
    kind,
    state,
    before,
    document: before,
    applied: [],
    skipped: [],
    diff: { added: [], changed: [], removed: [] },
  };
}

export function extendsApplied(applied: readonly unknown[], next: readonly unknown[]): boolean {
  if (next.length < applied.length) return false;
  for (let index = 0; index < applied.length; index++) {
    if (applied[index] !== next[index] && !jsonEqual(applied[index], next[index])) return false;
  }
  return true;
}

export async function advanceDraftSession(
  session: DraftSession,
  ops: readonly unknown[],
): Promise<DraftSession | "rebuild" | null> {
  const kit = getOpKind(session.kind)?.draft;
  if (!kit) return null;
  if (!extendsApplied(session.applied, ops)) return "rebuild";
  const base = session.applied.length;
  let pending = ops
    .slice(base)
    .map((op, offset) => ({ op, index: base + offset }))
    .filter((item) => typeof item.op === "object" && item.op !== null);
  const skipped = [...session.skipped];
  let state = session.state;
  let document = session.document;
  let diff = session.diff;
  for (let attempt = 0; attempt < DRAFT_ATTEMPTS && pending.length > 0; attempt++) {
    const result = await kit.step(
      session.state,
      pending.map((item) => item.op),
    );
    if (result.ok) {
      state = result.state;
      document = result.document as ErdDocumentJSON | FlowJSON;
      diff = mergeDocDiffs(diff, result.diff);
      pending = [];
      break;
    }
    const bad = new Set(result.errors.map((error) => error.index).filter((index) => index >= 0));
    if (bad.size === 0 || result.errors.some((error) => error.index < 0)) return null;
    for (const index of bad) {
      const error = result.errors.find((item) => item.index === index);
      const item = pending[index];
      if (error && item) skipped.push(`#${item.index} ${error.op}: ${error.message}`);
    }
    pending = pending.filter((_, index) => !bad.has(index));
  }
  if (pending.length > 0) return null;
  return { ...session, state, document, diff, applied: [...ops], skipped };
}

export async function rebuildDraftSession(
  session: DraftSession,
  ops: readonly unknown[],
): Promise<DraftSession | null> {
  const fresh = await startDraftSession(session.kind, session.before);
  if (!fresh) return null;
  const next = await advanceDraftSession(fresh, ops);
  return next === "rebuild" ? null : next;
}

export async function promoteDraftSession(
  session: DraftSession,
  ops: readonly unknown[],
): Promise<BatchApplication<ErdDocumentJSON | FlowJSON> | null> {
  const kit = getOpKind(session.kind)?.draft;
  if (!kit || !extendsApplied(session.applied, ops)) return null;
  const advanced =
    ops.length > session.applied.length ? await advanceDraftSession(session, ops) : session;
  if (!advanced || advanced === "rebuild") return null;
  const result = await kit.finish(advanced.state);
  if (!result.ok) return null;
  return {
    ok: true,
    document: result.document as ErdDocumentJSON | FlowJSON,
    diff: result.diff,
    idMap: result.idMap,
    warnings: result.warnings,
    skipped: [...advanced.skipped],
  };
}

export class CoalescingRunner<T> {
  private running = false;
  private next: { value: T; waiters: ((ok: boolean) => void)[] } | null = null;

  constructor(private readonly work: (value: T) => Promise<boolean>) {}

  submit(value: T): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.next) {
        this.next.value = value;
        this.next.waiters.push(resolve);
      } else {
        this.next = { value, waiters: [resolve] };
      }
      if (!this.running) void this.drain();
    });
  }

  clear(): void {
    const next = this.next;
    this.next = null;
    next?.waiters.forEach((resolve) => resolve(false));
  }

  get busy(): boolean {
    return this.running;
  }

  private async drain(): Promise<void> {
    this.running = true;
    while (this.next) {
      const { value, waiters } = this.next;
      this.next = null;
      let ok = false;
      try {
        ok = await this.work(value);
      } catch {
        ok = false;
      }
      waiters.forEach((resolve) => resolve(ok));
    }
    this.running = false;
  }
}

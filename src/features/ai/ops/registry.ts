import type { AiChangeLine } from "../components/aiOpChanges";
import type { DockChip } from "../components/aiDockLogic";
import type { AiEditorTargetKind } from "../../../types/ai.types";
import type { ErdDocumentJSON } from "../../../types/dataModel.types";
import type { FlowJSON } from "../../../types/flowchart.types";
import { describeErdOps, describeFlowOps } from "./describe";
import {
  applyErdDraftOps,
  applyErdOps,
  applyFlowOps,
  finishErdDraft,
  startErdDraft,
} from "./lazyApply";
import { parseErdOps } from "./parseErdOps";
import { parseFlowOps } from "./parseFlowOps";
import { ERD_OP_SPECS, ERD_OPS_JSON_SCHEMA, FLOW_OP_SPECS, FLOW_OPS_JSON_SCHEMA } from "./schemas";
import { summarizeErd, summarizeFlow } from "./summarize";
import type { ErdDraft } from "./applyErdOps";
import type {
  ApplyOpsOptions,
  ApplyOpsResult,
  DocDiff,
  ErdOp,
  ErdSummary,
  FlowOp,
  FlowSummary,
  OpError,
  ParseOpsResult,
} from "./types";

export type OpDraftStep<D, S> =
  { ok: true; state: S; document: D; diff: DocDiff } | { ok: false; errors: OpError[] };

export interface OpDraftKit<D, Op, S = unknown> {
  start: (doc: D) => Promise<S>;
  step: (state: S, ops: readonly Op[], options?: ApplyOpsOptions) => Promise<OpDraftStep<D, S>>;
  finish: (state: S) => Promise<ApplyOpsResult<D>>;
}

/**
 * A plugin describing everything the AI dock / op-batch pipeline needs to
 * know about one editable document kind ("data_model" or "flow"): how to
 * parse raw AI tool-call ops, apply them to a document, describe them as
 * human-readable change lines, summarize a document for the AI's context,
 * and which quick-action chips the dock shows for it.
 *
 * "workspace" batches are intentionally NOT modeled as an OpKindPlugin: a
 * workspace op batch applies across several independent entities (epics,
 * user stories, flows, data models) via `applyWorkspaceOps` in
 * workspaceOps.ts, which has a fundamentally different, stateful,
 * resumable apply shape (ops, deps, onProgress, options) rather than the
 * pure `(document, ops) => result` shape every data_model/flow plugin
 * shares. Forcing it into this interface would make the interface worse
 * for its two real members, not better for its third.
 */
export interface OpKindPlugin<D = unknown, Op = unknown> {
  kind: AiEditorTargetKind;
  specs: Record<string, unknown>;
  jsonSchema: unknown;
  parse: (raw: unknown) => ParseOpsResult<Op>;
  apply: (doc: D, ops: readonly Op[], options?: ApplyOpsOptions) => Promise<ApplyOpsResult<D>>;
  describe: (ops: readonly Op[], doc: D | null) => AiChangeLine[];
  summarize: (doc: D) => ErdSummary | FlowSummary;
  /** Returns `doc` with its content (entities/fields, nodes/edges, …) emptied out, keeping its identity/meta. */
  clearContent: (doc: D) => D;
  draft?: OpDraftKit<D, Op>;
  dockChips: readonly DockChip[];
}

const registry = new Map<AiEditorTargetKind, OpKindPlugin>();

export function registerOpKind<D, Op>(plugin: OpKindPlugin<D, Op>): void {
  registry.set(plugin.kind, plugin as unknown as OpKindPlugin);
}

export function getOpKind(kind: string): OpKindPlugin | undefined {
  return registry.get(kind as AiEditorTargetKind);
}

export function listOpKinds(): OpKindPlugin[] {
  return [...registry.values()];
}

const EDITOR_CHIPS: readonly DockChip[] = [
  { id: "ask", label: "Ask", needsPrompt: true, needsSelection: false },
  { id: "edit", label: "Edit", needsPrompt: true, needsSelection: false },
];

registerOpKind<ErdDocumentJSON, ErdOp>({
  kind: "data_model",
  specs: ERD_OP_SPECS,
  jsonSchema: ERD_OPS_JSON_SCHEMA,
  parse: parseErdOps,
  apply: applyErdOps,
  describe: describeErdOps,
  summarize: summarizeErd,
  clearContent: (doc) => ({ ...doc, entities: [], relationships: [], enums: [], notes: [] }),
  draft: {
    start: startErdDraft,
    step: async (state, ops, options) => {
      const result = await applyErdDraftOps(state as ErdDraft, ops, options);
      return result.ok
        ? { ok: true, state: result.draft, document: result.draft.doc, diff: result.diff }
        : result;
    },
    finish: (state) => finishErdDraft(state as ErdDraft),
  },
  dockChips: EDITOR_CHIPS,
});

registerOpKind<FlowJSON, FlowOp>({
  kind: "flow",
  specs: FLOW_OP_SPECS,
  jsonSchema: FLOW_OPS_JSON_SCHEMA,
  parse: parseFlowOps,
  apply: applyFlowOps,
  describe: describeFlowOps,
  summarize: summarizeFlow,
  clearContent: (doc) => ({ ...doc, nodes: [], edges: [] }),
  dockChips: EDITOR_CHIPS,
});

import type { DataModelEngine, ErdDocumentJSON } from "../../../types/dataModel.types";
import type { FlowJSON } from "../../../types/flowchart.types";
import { createEmptyErdDocument } from "../../../utils/erd/erdSerialization";
import { parseErdOps } from "./parseErdOps";
import { parseFlowOps } from "./parseFlowOps";
import type { ErdOp, FlowOp, OpError, WorkspaceOp } from "./types";

export type WorkspaceItemKind = "epic" | "user_story" | "flow" | "data_model";

export interface WorkspaceApplyItem {
  index: number;
  op: string;
  kind: WorkspaceItemKind;
  action: "created" | "updated";
  label: string;
  status: "done" | "failed" | "skipped";
  id?: string;
  error?: string;
}

export interface WorkspaceApplyResult {
  items: WorkspaceApplyItem[];
  done: number;
  failed: number;
}

export interface WorkspaceTextInput {
  title?: string;
  description?: string;
}

export type WorkspaceBoardItem =
  | { op: "createEpic"; tempId?: string; title: string; description: string }
  | { op: "updateEpic"; epic: string; title?: string; description?: string }
  | { op: "createUserStory"; tempId?: string; epic: string; title: string; description: string }
  | { op: "updateUserStory"; story: string; title?: string; description?: string };

export interface WorkspaceResumeEntry {
  id: string;
  complete: boolean;
}

export interface WorkspaceApplyOptions {
  resume?: ReadonlyMap<number, WorkspaceResumeEntry>;
  onCreated?: (index: number, entry: WorkspaceResumeEntry) => void;
}

export interface WorkspaceApplyDeps {
  board?(items: WorkspaceBoardItem[]): Promise<{ id: string }[]>;
  epics?: readonly { id: string; title: string }[];
  stories?: readonly { id: string; title: string }[];
  createEpic(input: { title: string; description: string }): Promise<{ id: string }>;
  updateEpic(id: string, input: WorkspaceTextInput): Promise<void>;
  createUserStory(
    epicId: string,
    input: { title: string; description: string },
  ): Promise<{ id: string }>;
  updateUserStory(id: string, input: WorkspaceTextInput): Promise<void>;
  createFlow(input: { name: string; description?: string }): Promise<{ id: string }>;
  loadFlow(id: string): Promise<{ revision: number; document: FlowJSON }>;
  saveFlow(id: string, revision: number, document: FlowJSON): Promise<void>;
  createDataModel(input: {
    name: string;
    description?: string;
    engine?: DataModelEngine;
  }): Promise<{ id: string }>;
  loadDataModel(id: string): Promise<{ revision: number; document: ErdDocumentJSON }>;
  saveDataModel(id: string, revision: number, document: ErdDocumentJSON): Promise<void>;
}

export const WORKSPACE_OP_NAMES = [
  "createEpic",
  "updateEpic",
  "createUserStory",
  "updateUserStory",
  "createFlow",
  "createDataModel",
] as const;

const EMPTY_FLOW: FlowJSON = {
  version: 1,
  nodes: [],
  edges: [],
  meta: { name: "", edgeType: "step" },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const messageOf = (err: unknown): string =>
  err instanceof Error && err.message ? err.message : "Something went wrong";

const firstError = (errors: readonly OpError[]): string => {
  const first = errors[0];
  if (!first) return "The operations are not valid";
  return first.index >= 0 ? `op ${first.index + 1} (${first.op}): ${first.message}` : first.message;
};

const stripTemp = (ref: string) => ref.trim().replace(/^\$/, "");

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function isWorkspaceOp(value: unknown): value is WorkspaceOp {
  return (
    isRecord(value) &&
    typeof value.op === "string" &&
    (WORKSPACE_OP_NAMES as readonly string[]).includes(value.op)
  );
}

export function workspaceOpKind(op: WorkspaceOp): WorkspaceItemKind {
  switch (op.op) {
    case "createEpic":
    case "updateEpic":
      return "epic";
    case "createUserStory":
    case "updateUserStory":
      return "user_story";
    case "createFlow":
      return "flow";
    default:
      return "data_model";
  }
}

export function workspaceOpLabel(op: WorkspaceOp): string {
  switch (op.op) {
    case "createEpic":
      return text(op.title) || "Untitled epic";
    case "createUserStory":
      return text(op.title) || "Untitled user story";
    case "createFlow":
    case "createDataModel":
      return text(op.name) || "Untitled";
    case "updateEpic":
      return text(op.title) || text(op.epic);
    default:
      return text(op.title) || text(op.story);
  }
}

class Failure extends Error {}

export async function applyWorkspaceOps(
  ops: readonly WorkspaceOp[],
  deps: WorkspaceApplyDeps,
  onProgress?: (items: readonly WorkspaceApplyItem[]) => void,
  options: WorkspaceApplyOptions = {},
): Promise<WorkspaceApplyResult> {
  const resume = options.resume;
  const created = (index: number, id: string, complete = true) =>
    options.onCreated?.(index, { id, complete });
  const temps = new Map<string, string>();
  const failedTemps = new Set<string>();
  const items: WorkspaceApplyItem[] = [];

  const resolve = (
    ref: string,
    known: readonly { id: string; title: string }[] | undefined,
    noun: string,
  ): string => {
    const key = ref.trim();
    const temp = temps.get(key) ?? temps.get(stripTemp(key));
    if (temp) return temp;
    if (failedTemps.has(key) || failedTemps.has(stripTemp(key))) {
      throw new Failure(`Skipped because the ${noun} it belongs to could not be created`);
    }
    const byId = known?.find((item) => item.id === key);
    if (byId) return byId.id;
    const byTitle = known?.filter((item) => sameText(item.title, key)) ?? [];
    if (byTitle.length === 1) return byTitle[0]!.id;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) return key;
    throw new Failure(`The ${noun} "${key}" was not found`);
  };

  const buildFlow = async (name: string, raw: unknown, base: FlowJSON): Promise<FlowJSON> => {
    const parsed = parseFlowOps(raw);
    if (!parsed.ok) throw new Failure(firstError(parsed.errors));
    const { applyFlowOps } = await import("./applyFlowOps");
    const applied = applyFlowOps(base, parsed.ops as FlowOp[]);
    if (!applied.ok) throw new Failure(firstError(applied.errors));
    const meta = { ...applied.document.meta };
    if (!text(meta.name)) meta.name = name;
    return { ...applied.document, meta };
  };

  const buildModel = async (raw: unknown, base: ErdDocumentJSON): Promise<ErdDocumentJSON> => {
    const parsed = parseErdOps(raw);
    if (!parsed.ok) throw new Failure(firstError(parsed.errors));
    const { applyErdOps } = await import("./applyErdOps");
    const applied = applyErdOps(base, parsed.ops as ErdOp[]);
    if (!applied.ok) throw new Failure(firstError(applied.errors));
    return applied.document;
  };

  const isBoardOp = (op: WorkspaceOp) =>
    op.op === "createEpic" ||
    op.op === "updateEpic" ||
    op.op === "createUserStory" ||
    op.op === "updateUserStory";

  const makeItem = (index: number, op: WorkspaceOp): WorkspaceApplyItem => ({
    index,
    op: op.op,
    kind: workspaceOpKind(op),
    action: op.op.startsWith("create") ? "created" : "updated",
    label: workspaceOpLabel(op),
    status: "done",
  });

  const runBoard = async (from: number, to: number) => {
    const sent: { item: WorkspaceApplyItem; op: WorkspaceOp; payload: WorkspaceBoardItem }[] = [];
    const local = new Set<string>();
    for (let i = from; i < to; i++) {
      const op = ops[i]!;
      const item = makeItem(i, op);
      const resumed = resume?.get(i);
      if (resumed?.complete) {
        item.id = resumed.id;
        if ("tempId" in op && op.tempId) temps.set(op.tempId, resumed.id);
        items.push(item);
        continue;
      }
      try {
        let payload: WorkspaceBoardItem;
        const ref = (value: string, known: typeof deps.epics, noun: string) =>
          local.has(value.trim()) ? value.trim() : resolve(value, known, noun);
        switch (op.op) {
          case "createEpic":
            payload = {
              op: "createEpic",
              tempId: op.tempId,
              title: text(op.title),
              description: text(op.description),
            };
            if (op.tempId) local.add(op.tempId);
            break;
          case "updateEpic":
            payload = {
              op: "updateEpic",
              epic: ref(op.epic, deps.epics, "epic"),
              title: op.title,
              description: op.description,
            };
            break;
          case "createUserStory":
            payload = {
              op: "createUserStory",
              tempId: op.tempId,
              epic: ref(op.epic, deps.epics, "epic"),
              title: text(op.title),
              description: text(op.description),
            };
            if (op.tempId) local.add(op.tempId);
            break;
          default:
            payload = {
              op: "updateUserStory",
              story: resolve((op as { story: string }).story, deps.stories, "user story"),
              title: (op as { title?: string }).title,
              description: (op as { description?: string }).description,
            };
        }
        sent.push({ item, op, payload });
      } catch (err) {
        item.status =
          err instanceof Failure && err.message.startsWith("Skipped") ? "skipped" : "failed";
        item.error = messageOf(err);
        if ("tempId" in op && op.tempId) failedTemps.add(op.tempId);
        items.push(item);
      }
    }
    if (sent.length > 0) {
      try {
        const board = await deps.board!(sent.map((entry) => entry.payload));
        sent.forEach((entry, i) => {
          entry.item.id = board[i]?.id;
          if ("tempId" in entry.op && entry.op.tempId && board[i]) {
            temps.set(entry.op.tempId, board[i]!.id);
          }
          if (board[i]) created(entry.item.index, board[i]!.id);
          items.push(entry.item);
        });
      } catch (err) {
        for (const entry of sent) {
          entry.item.status = "failed";
          entry.item.error = messageOf(err);
          if ("tempId" in entry.op && entry.op.tempId) failedTemps.add(entry.op.tempId);
          items.push(entry.item);
        }
      }
    }
    items.sort((a, b) => a.index - b.index);
    onProgress?.(items.slice());
  };

  for (let index = 0; index < ops.length; index++) {
    const op = ops[index]!;
    if (deps.board && isBoardOp(op)) {
      let end = index + 1;
      while (end < ops.length && isBoardOp(ops[end]!)) end++;
      await runBoard(index, end);
      index = end - 1;
      continue;
    }
    const item: WorkspaceApplyItem = {
      index,
      op: op.op,
      kind: workspaceOpKind(op),
      action: op.op.startsWith("create") ? "created" : "updated",
      label: workspaceOpLabel(op),
      status: "done",
    };
    const resumed = resume?.get(index);
    if (resumed?.complete) {
      item.id = resumed.id;
      if ("tempId" in op && op.tempId) temps.set(op.tempId, resumed.id);
      items.push(item);
      onProgress?.(items.slice());
      continue;
    }
    try {
      switch (op.op) {
        case "createEpic": {
          const made = await deps.createEpic({
            title: text(op.title),
            description: text(op.description),
          });
          item.id = made.id;
          if (op.tempId) temps.set(op.tempId, made.id);
          created(index, made.id);
          break;
        }
        case "updateEpic": {
          const id = resolve(op.epic, deps.epics, "epic");
          await deps.updateEpic(id, { title: op.title, description: op.description });
          item.id = id;
          created(index, id);
          break;
        }
        case "createUserStory": {
          const epicId = resolve(op.epic, deps.epics, "epic");
          const made = await deps.createUserStory(epicId, {
            title: text(op.title),
            description: text(op.description),
          });
          item.id = made.id;
          if (op.tempId) temps.set(op.tempId, made.id);
          created(index, made.id);
          break;
        }
        case "updateUserStory": {
          const id = resolve(op.story, deps.stories, "user story");
          await deps.updateUserStory(id, { title: op.title, description: op.description });
          item.id = id;
          created(index, id);
          break;
        }
        case "createFlow": {
          await buildFlow(op.name, op.ops, EMPTY_FLOW);
          let flowId = resumed?.id;
          if (!flowId) {
            const made = await deps.createFlow({
              name: text(op.name),
              description: text(op.description) || undefined,
            });
            flowId = made.id;
            created(index, flowId, false);
          }
          item.id = flowId;
          if (op.tempId) temps.set(op.tempId, flowId);
          const loaded = await deps.loadFlow(flowId);
          if (resumed && loaded.document.nodes.length > 0) {
            created(index, flowId);
            break;
          }
          await deps.saveFlow(
            flowId,
            loaded.revision,
            await buildFlow(text(op.name), op.ops, loaded.document),
          );
          created(index, flowId);
          break;
        }
        case "createDataModel": {
          const engine = op.engine ?? "na";
          await buildModel(op.ops, createEmptyErdDocument(engine, text(op.name)));
          const overview = op.ops.find((item) => item.op === "setModelDescription");
          let modelId = resumed?.id;
          if (!modelId) {
            const made = await deps.createDataModel({
              name: text(op.name),
              description:
                text(op.description) ||
                (overview?.op === "setModelDescription" ? text(overview.description) : "") ||
                undefined,
              engine,
            });
            modelId = made.id;
            created(index, modelId, false);
          }
          item.id = modelId;
          if (op.tempId) temps.set(op.tempId, modelId);
          const loaded = await deps.loadDataModel(modelId);
          if (resumed && loaded.document.entities.length > 0) {
            created(index, modelId);
            break;
          }
          await deps.saveDataModel(
            modelId,
            loaded.revision,
            await buildModel(op.ops, loaded.document),
          );
          created(index, modelId);
          break;
        }
        default:
          throw new Failure("Unknown operation");
      }
    } catch (err) {
      item.status =
        err instanceof Failure && err.message.startsWith("Skipped") ? "skipped" : "failed";
      item.error = messageOf(err);
      if ("tempId" in op && op.tempId && !temps.has(op.tempId)) failedTemps.add(op.tempId);
    }
    items.push(item);
    onProgress?.(items.slice());
  }
  return {
    items,
    done: items.filter((item) => item.status === "done").length,
    failed: items.filter((item) => item.status !== "done").length,
  };
}

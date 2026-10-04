import { getOpKind } from "../../ai/ops/registry";
import type { WorkspaceOp } from "../../ai/ops/types";
import type { AiOpBatch } from "../../types/ai.types";
import type { ErdDocumentJSON } from "../../types/dataModel.types";
import type { FlowJSON } from "../../types/flowchart.types";

export type AiChangeKind = "add" | "change" | "remove";

export interface AiChangeLine {
  kind: AiChangeKind;
  subject: string;
  detail?: string;
  before?: string;
  after?: string;
  opIndex?: number;
}

export const CHANGE_MARKS: Record<AiChangeKind, string> = { add: "+", change: "~", remove: "−" };

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function describeWorkspaceOps(ops: readonly WorkspaceOp[]): AiChangeLine[] {
  const storiesByEpic = new Map<string, number>();
  for (const op of ops) {
    if (op.op === "createUserStory") {
      storiesByEpic.set(op.epic, (storiesByEpic.get(op.epic) ?? 0) + 1);
    }
  }
  return ops.map((op): AiChangeLine => {
    switch (op.op) {
      case "createEpic": {
        const stories = (op.tempId ? storiesByEpic.get(op.tempId) : 0) ?? 0;
        return {
          kind: "add",
          subject: `Epic · ${op.title}`,
          detail: stories > 0 ? plural(stories, "story", "stories") : undefined,
        };
      }
      case "updateEpic":
        return {
          kind: "change",
          subject: `Epic · ${op.title ?? op.label ?? "Existing epic"}`,
          detail: [op.title ? "title" : "", op.description ? "notes" : ""]
            .filter(Boolean)
            .join(", "),
        };
      case "createUserStory":
        return { kind: "add", subject: `User story · ${op.title}` };
      case "updateUserStory":
        return {
          kind: "change",
          subject: `User story · ${op.title ?? op.label ?? "Existing user story"}`,
          detail: [op.title ? "title" : "", op.description ? "notes" : ""]
            .filter(Boolean)
            .join(", "),
        };
      case "createFlow":
        return {
          kind: "add",
          subject: `Flow · ${op.name}`,
          detail: plural(op.ops.filter((item) => item.op === "addNode").length, "step", "steps"),
        };
      case "createDataModel":
        return {
          kind: "add",
          subject: `Data model · ${op.name}`,
          detail: plural(
            op.ops.filter((item) => item.op === "addEntity").length,
            "entity",
            "entities",
          ),
        };
      default:
        return { kind: "change", subject: "Workspace" };
    }
  });
}

export function describeOpBatch(
  batch: AiOpBatch,
  doc: ErdDocumentJSON | FlowJSON | null,
): AiChangeLine[] {
  if (batch.targetKind === "workspace") return describeWorkspaceOps(batch.ops);
  return getOpKind(batch.targetKind)?.describe(batch.ops, doc) ?? [];
}

export function countChanges(lines: readonly AiChangeLine[]): Record<AiChangeKind, number> {
  const counts: Record<AiChangeKind, number> = { add: 0, change: 0, remove: 0 };
  for (const line of lines) counts[line.kind]++;
  return counts;
}

export interface WorkspaceTreeNode {
  index: number;
  kind: "epic" | "user_story" | "flow" | "data_model";
  action: "create" | "update";
  title: string;
  hint?: string;
  notes: string;
  details: string[];
  children: WorkspaceTreeNode[];
}

export function describeWorkspaceTree(
  ops: readonly WorkspaceOp[],
  epicTitleOf?: (id: string) => string | undefined,
): WorkspaceTreeNode[] {
  const roots: WorkspaceTreeNode[] = [];
  const byTemp = new Map<string, WorkspaceTreeNode>();
  const epicTitles = new Map<string, string>();
  ops.forEach((op) => {
    if (op.op === "createEpic" && op.tempId) epicTitles.set(op.tempId, op.title);
  });
  ops.forEach((op, index) => {
    switch (op.op) {
      case "createEpic": {
        const node: WorkspaceTreeNode = {
          index,
          kind: "epic",
          action: "create",
          title: op.title,
          notes: op.description,
          details: [],
          children: [],
        };
        if (op.tempId) byTemp.set(op.tempId, node);
        roots.push(node);
        return;
      }
      case "updateEpic":
        roots.push({
          index,
          kind: "epic",
          action: "update",
          title: op.title ?? op.label ?? "Existing epic",
          hint: "notes updated",
          notes: op.description ?? "",
          details: [],
          children: [],
        });
        return;
      case "createUserStory": {
        const node: WorkspaceTreeNode = {
          index,
          kind: "user_story",
          action: "create",
          title: op.title,
          notes: op.description,
          details: [],
          children: [],
        };
        const parent = byTemp.get(op.epic);
        if (parent) parent.children.push(node);
        else {
          const known = epicTitles.get(op.epic) ?? op.label ?? epicTitleOf?.(op.epic);
          node.hint = known ? `in ${known}` : "in an existing epic";
          roots.push(node);
        }
        return;
      }
      case "updateUserStory":
        roots.push({
          index,
          kind: "user_story",
          action: "update",
          title: op.title ?? op.label ?? "Existing user story",
          hint: "notes updated",
          notes: op.description ?? "",
          details: [],
          children: [],
        });
        return;
      case "createFlow": {
        const steps = op.ops
          .filter((item) => item.op === "addNode")
          .map((item) => (item.op === "addNode" ? item.label : ""))
          .filter(Boolean);
        roots.push({
          index,
          kind: "flow",
          action: "create",
          title: op.name,
          hint: plural(steps.length, "step", "steps"),
          notes: op.description ?? "",
          details: steps,
          children: [],
        });
        return;
      }
      case "createDataModel": {
        const entities = op.ops
          .filter((item) => item.op === "addEntity")
          .map((item) => (item.op === "addEntity" ? item.name : ""))
          .filter(Boolean);
        const overview = op.ops.find((item) => item.op === "setModelDescription");
        roots.push({
          index,
          kind: "data_model",
          action: "create",
          title: op.name,
          hint: plural(entities.length, "entity", "entities"),
          notes:
            op.description ?? (overview?.op === "setModelDescription" ? overview.description : ""),
          details: entities,
          children: [],
        });
        return;
      }
    }
  });
  return roots;
}

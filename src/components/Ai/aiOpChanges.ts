import type { ErdOp, ErdOpFieldInput, FlowOp, WorkspaceOp } from "../../ai/ops/types";
import type { AiOpBatch } from "../../types/ai.types";
import type { ErdDocumentJSON, ErdEntity } from "../../types/dataModel.types";
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

const clip = (text: string, max = 60) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "none";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (Array.isArray(value)) return clip(value.map((item) => show(item)).join(", "));
  if (typeof value === "object") return clip(JSON.stringify(value));
  return clip(String(value));
}

const same = (a: string | undefined, b: string) =>
  a !== undefined && a.trim().toLowerCase() === b.trim().toLowerCase();

const stripTemp = (ref: string) => ref.trim().replace(/^\$/, "");

function lookup<T extends { id: string }>(
  items: readonly T[],
  ref: string,
  name: (item: T) => string | undefined,
): T | undefined {
  const key = ref.trim();
  return items.find((item) => item.id === key) ?? items.find((item) => same(name(item), key));
}

function fieldType(field: Partial<ErdOpFieldInput>): string {
  if (!field.type) return "";
  if (field.length !== undefined) return `${field.type}(${field.length})`;
  if (field.precision !== undefined) {
    return `${field.type}(${field.precision}${field.scale !== undefined ? `,${field.scale}` : ""})`;
  }
  return field.type;
}

function patchLines(
  subject: string,
  patch: Record<string, unknown>,
  before: (key: string) => unknown,
  kind: AiChangeKind = "change",
): AiChangeLine[] {
  const keys = Object.keys(patch).filter((key) => patch[key] !== undefined);
  if (keys.length === 0) return [{ kind, subject }];
  return keys.map((key) => ({
    kind,
    subject,
    detail: key,
    before: show(before(key)),
    after: show(patch[key]),
  }));
}

function describeErdOps(ops: readonly ErdOp[], doc: ErdDocumentJSON | null): AiChangeLine[] {
  const entities = doc?.entities ?? [];
  const temps = new Map<string, string>();
  const entityName = (ref: string) => {
    const temp = temps.get(stripTemp(ref));
    if (temp) return temp;
    return lookup(entities, ref, (item) => item.name)?.name ?? stripTemp(ref);
  };
  const entity = (ref: string): ErdEntity | undefined => lookup(entities, ref, (item) => item.name);
  const fieldOf = (entityRef: string, ref: string) =>
    entity(entityRef) ? lookup(entity(entityRef)!.fields, ref, (item) => item.name) : undefined;
  const fieldName = (entityRef: string, ref: string) =>
    temps.get(stripTemp(ref)) ?? fieldOf(entityRef, ref)?.name ?? stripTemp(ref);
  const enumName = (ref: string | null | undefined) =>
    ref ? (lookup(doc?.enums ?? [], ref, (item) => item.name)?.name ?? stripTemp(ref)) : null;
  const relationshipName = (ref: string) => {
    const rel = lookup(doc?.relationships ?? [], ref, (item) => item.name);
    if (!rel) return stripTemp(ref);
    if (rel.name) return rel.name;
    const source = entities.find((item) => item.id === rel.sourceEntityId)?.name ?? "?";
    const target = entities.find((item) => item.id === rel.targetEntityId)?.name ?? "?";
    return `${source} → ${target}`;
  };

  const lineFor = (op: ErdOp): AiChangeLine[] => {
    switch (op.op) {
      case "addEntity": {
        if (op.tempId) temps.set(stripTemp(op.tempId), op.name);
        const count = op.fields?.length ?? 0;
        return [
          {
            kind: "add",
            subject: op.name,
            detail: count > 0 ? `${count} field${count === 1 ? "" : "s"}` : "entity",
          },
        ];
      }
      case "updateEntity": {
        const current = entity(op.entity);
        return patchLines(entityName(op.entity), op.patch, (key) =>
          current ? (current as unknown as Record<string, unknown>)[key] : undefined,
        );
      }
      case "removeEntity":
        return [{ kind: "remove", subject: entityName(op.entity), detail: "entity" }];
      case "addField":
        if (op.tempId) temps.set(stripTemp(op.tempId), op.field.name);
        return [
          {
            kind: "add",
            subject: `${entityName(op.entity)}.${op.field.name}`,
            detail: fieldType(op.field) || "field",
          },
        ];
      case "updateField": {
        const current = fieldOf(op.entity, op.field);
        const subject = `${entityName(op.entity)}.${fieldName(op.entity, op.field)}`;
        return patchLines(subject, op.patch, (key) => {
          if (!current) return undefined;
          if (key === "enum") return enumName(current.enumId);
          return (current as unknown as Record<string, unknown>)[key];
        });
      }
      case "removeField":
        return [
          { kind: "remove", subject: `${entityName(op.entity)}.${fieldName(op.entity, op.field)}` },
        ];
      case "moveField":
        return [
          {
            kind: "change",
            subject: `${entityName(op.entity)}.${fieldName(op.entity, op.field)}`,
            detail: `moved to position ${op.toIndex + 1}`,
          },
        ];
      case "addRelationship":
        return [
          {
            kind: "add",
            subject: op.name ?? `${entityName(op.source)} → ${entityName(op.target)}`,
            detail: op.cardinality,
          },
        ];
      case "updateRelationship": {
        const rel = lookup(doc?.relationships ?? [], op.relationship, (item) => item.name);
        return patchLines(relationshipName(op.relationship), op.patch, (key) =>
          rel ? (rel as unknown as Record<string, unknown>)[key] : undefined,
        );
      }
      case "removeRelationship":
        return [
          { kind: "remove", subject: relationshipName(op.relationship), detail: "relationship" },
        ];
      case "addIndex":
        return [
          {
            kind: "add",
            subject: `${entityName(op.entity)} index${op.name ? ` ${op.name}` : ""}`,
            detail: op.fields.map((ref) => fieldName(op.entity, ref)).join(", "),
          },
        ];
      case "updateIndex":
        return patchLines(
          `${entityName(op.entity)} index ${stripTemp(op.index)}`,
          op.patch,
          () => undefined,
        );
      case "removeIndex":
        return [
          { kind: "remove", subject: `${entityName(op.entity)} index ${stripTemp(op.index)}` },
        ];
      case "addEnum":
        return [{ kind: "add", subject: `enum ${op.name}`, detail: show(op.values) }];
      case "updateEnum": {
        const current = lookup(doc?.enums ?? [], op.enum, (item) => item.name);
        return patchLines(`enum ${enumName(op.enum)}`, op.patch, (key) =>
          current ? (current as unknown as Record<string, unknown>)[key] : undefined,
        );
      }
      case "removeEnum":
        return [{ kind: "remove", subject: `enum ${enumName(op.enum)}` }];
      case "addNote":
        return [{ kind: "add", subject: "note", detail: clip(op.text, 40) }];
      case "updateNote":
        return [
          {
            kind: "change",
            subject: "note",
            detail: op.patch.text ? clip(op.patch.text, 40) : undefined,
          },
        ];
      case "removeNote":
        return [{ kind: "remove", subject: "note" }];
      case "setEngine":
        return [
          { kind: "change", subject: "engine", before: show(doc?.engine), after: show(op.engine) },
        ];
      case "setModelName":
        return [
          {
            kind: "change",
            subject: "model name",
            before: show(doc?.meta?.name),
            after: show(op.name),
          },
        ];
      case "setModelDescription":
        return [{ kind: "change", subject: "model description", detail: clip(op.description, 50) }];
      case "autoLayout":
        return [{ kind: "change", subject: "layout", detail: "auto-arrange" }];
      default:
        return [];
    }
  };
  return ops.flatMap((op, opIndex) => lineFor(op).map((line) => ({ ...line, opIndex })));
}

function describeFlowOps(ops: readonly FlowOp[], doc: FlowJSON | null): AiChangeLine[] {
  const nodes = doc?.nodes ?? [];
  const edges = doc?.edges ?? [];
  const temps = new Map<string, string>();
  const labelOf = (node: (typeof nodes)[number]) =>
    typeof node.data?.label === "string" ? node.data.label : undefined;
  const node = (ref: string) => lookup(nodes, ref, labelOf);
  const nodeName = (ref: string) =>
    temps.get(stripTemp(ref)) ?? (node(ref) ? (labelOf(node(ref)!) ?? ref) : stripTemp(ref));
  const edgeName = (ref: string) => {
    const edge = lookup(edges, ref, (item) => item.label);
    if (!edge) return stripTemp(ref);
    return `${nodeName(edge.source)} → ${nodeName(edge.target)}`;
  };

  const lineFor = (op: FlowOp): AiChangeLine[] => {
    switch (op.op) {
      case "addNode":
        if (op.tempId) temps.set(stripTemp(op.tempId), op.label);
        return [{ kind: "add", subject: op.label, detail: op.type }];
      case "updateNode": {
        const current = node(op.node);
        return patchLines(nodeName(op.node), op.patch, (key) => {
          if (!current) return undefined;
          if (key === "type") return current.type;
          return (current.data as unknown as Record<string, unknown>)[key];
        });
      }
      case "removeNode":
        return [{ kind: "remove", subject: nodeName(op.node) }];
      case "addEdge":
        if (op.tempId) {
          temps.set(stripTemp(op.tempId), `${nodeName(op.source)} → ${nodeName(op.target)}`);
        }
        return [
          {
            kind: "add",
            subject: `${nodeName(op.source)} → ${nodeName(op.target)}`,
            detail: op.label,
          },
        ];
      case "updateEdge": {
        const current = lookup(edges, op.edge, (item) => item.label);
        return patchLines(edgeName(op.edge), op.patch, (key) =>
          current ? (current as unknown as Record<string, unknown>)[key] : undefined,
        );
      }
      case "removeEdge":
        return [{ kind: "remove", subject: edgeName(op.edge) }];
      case "insertNodeOnEdge":
        if (op.tempId) temps.set(stripTemp(op.tempId), op.label);
        return [{ kind: "add", subject: op.label, detail: `on ${edgeName(op.edge)}` }];
      case "setFlowName":
        return [
          {
            kind: "change",
            subject: "flow name",
            before: show(doc?.meta?.name),
            after: show(op.name),
          },
        ];
      case "setFlowNotes":
        return [{ kind: "change", subject: "notes", detail: clip(op.notes, 40) }];
      case "autoLayout":
        return [{ kind: "change", subject: "layout", detail: "auto-arrange" }];
      default:
        return [];
    }
  };
  return ops.flatMap((op, opIndex) => lineFor(op).map((line) => ({ ...line, opIndex })));
}

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
  return batch.targetKind === "data_model"
    ? describeErdOps(batch.ops, doc as ErdDocumentJSON | null)
    : describeFlowOps(batch.ops, doc as FlowJSON | null);
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

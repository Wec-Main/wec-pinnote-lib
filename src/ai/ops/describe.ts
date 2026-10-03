import type { AiChangeLine } from "../../components/Ai/aiOpChanges";
import type { ErdDocumentJSON, ErdEntity } from "../../types/dataModel.types";
import type { FlowJSON } from "../../types/flowchart.types";
import type { ErdOp, ErdOpFieldInput, FlowOp } from "./types";

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
  kind: AiChangeLine["kind"] = "change",
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

export function describeErdOps(ops: readonly ErdOp[], doc: ErdDocumentJSON | null): AiChangeLine[] {
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

export function describeFlowOps(ops: readonly FlowOp[], doc: FlowJSON | null): AiChangeLine[] {
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

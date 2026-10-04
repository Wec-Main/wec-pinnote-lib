import {
  DATA_MODEL_ENGINES,
  type ErdCardinality,
  type ErdDocumentJSON,
  type ErdEntity,
  type ErdEnum,
  type ErdField,
  type ErdIndex,
  type ErdNote,
  type ErdReferentialAction,
  type ErdRelationship,
} from "../../../types/dataModel.types";
import type { Rect } from "../../../types/flowchart.types";
import { ENTITY_DEFAULT_WIDTH, GRID_GAP, NOTE_DEFAULT_SIZE } from "../../../utils/erd/erdConstants";
import { entityHeight, getEntityRect, getNoteRect } from "../../../utils/erd/erdGeometry";
import { layoutErd, layoutNotesBelow, readingOrder } from "../../../utils/erd/erdLayout";
import {
  findReferenceColumn,
  holdsReference,
  referenceKey,
} from "../../../utils/erd/erdReferences";
import { parseErdDocument } from "../../../utils/erd/erdSerialization";
import { validateErd } from "../../../utils/erd/erdValidator";
import { createId } from "../../../utils/flowchart/id";
import { diffErd } from "./diff";
import { AI_ERD_LIMITS } from "./limits";
import { avoidOverlap, rightMost } from "./placement";
import {
  IdFactory,
  TempIds,
  cloneJson,
  jsonEqual,
  resolveRef,
  type RefCandidate,
  type RefKind,
} from "./refs";
import type {
  ApplyOpsOptions,
  ApplyOpsResult,
  DocDiff,
  ErdOp,
  ErdOpFieldInput,
  ErdOpName,
  OpError,
  OpErrorCode,
  OpRef,
} from "./types";

const CARDINALITIES: readonly ErdCardinality[] = ["one-to-one", "one-to-many", "many-to-many"];
const ACTIONS: readonly ErdReferentialAction[] = ["cascade", "restrict", "set-null", "no-action"];

interface Placement {
  kind: "entity" | "note";
  id: string;
  nearId: string | null;
}

const AUTO_LAYOUT_MIN_ADDED = 3;
const AUTO_LAYOUT_MAX_EXISTING = 2;

interface Context {
  doc: ErdDocumentJSON;
  temps: TempIds;
  ids: IdFactory;
  placements: Placement[];
  warnings: string[];
  laidOut: boolean;
}

interface Run {
  fail: (code: OpErrorCode, message: string) => void;
  failed: () => boolean;
}

type Handler<N extends ErdOpName> = (op: Extract<ErdOp, { op: N }>, ctx: Context, run: Run) => void;

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const candidates = (items: readonly { id: string; name?: string }[]): RefCandidate[] =>
  items.map((item) => ({ id: item.id, name: item.name }));

function nextName(prefix: string, taken: readonly string[]): string {
  const used = new Set(taken.map((name) => name.toLowerCase()));
  let n = taken.length + 1;
  while (used.has(`${prefix}_${n}`)) n++;
  return `${prefix}_${n}`;
}

function resolve(
  ctx: Context,
  run: Run,
  kind: RefKind,
  ref: OpRef,
  pool: RefCandidate[],
  scope: string | null = null,
): string | null {
  const result = resolveRef(ref, kind, pool, ctx.temps, scope);
  if (result.ok) return result.id;
  run.fail(result.code, result.message);
  return null;
}

function claimTemp(ctx: Context, run: Run, tempId: string | undefined, local?: Set<string>): void {
  if (tempId === undefined) return;
  const key = tempId.trim().startsWith("$") ? tempId.trim() : `$${tempId.trim()}`;
  if (key === "$") {
    run.fail("invalid_value", "tempId must not be empty");
    return;
  }
  if (ctx.temps.has(key) || local?.has(key)) {
    run.fail("duplicate_temp_id", `Temp id ${key} is declared more than once`);
  }
  local?.add(key);
}

function requireName(run: Run, what: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) run.fail("invalid_value", `${what} must not be empty`);
  return trimmed;
}

function checkUnique(
  run: Run,
  what: string,
  name: string,
  existing: readonly { id: string; name?: string }[],
  exceptId?: string,
): void {
  const clash = existing.find(
    (item) => item.id !== exceptId && item.name !== undefined && sameName(item.name, name),
  );
  if (clash) run.fail("duplicate_name", `${what} "${name}" already exists (${clash.id})`);
}

function findEntity(ctx: Context, id: string): ErdEntity {
  return ctx.doc.entities.find((entity) => entity.id === id) as ErdEntity;
}

function replaceEntity(ctx: Context, next: ErdEntity): void {
  ctx.doc.entities = ctx.doc.entities.map((entity) => (entity.id === next.id ? next : entity));
}

function resolveEnum(ctx: Context, run: Run, ref: OpRef | null | undefined): string | undefined {
  if (ref === undefined || ref === null) return undefined;
  return resolve(ctx, run, "enum", ref, candidates(ctx.doc.enums)) ?? undefined;
}

function buildField(id: string, input: ErdOpFieldInput, enumId: string | undefined): ErdField {
  const primaryKey = input.primaryKey ?? false;
  const field: ErdField = {
    id,
    name: input.name.trim(),
    type: input.type.trim(),
    nullable: input.nullable ?? !primaryKey,
    primaryKey,
    unique: input.unique ?? false,
  };
  if (input.length !== undefined) field.length = input.length;
  if (input.precision !== undefined) field.precision = input.precision;
  if (input.scale !== undefined) field.scale = input.scale;
  if (typeof input.defaultValue === "string") field.defaultValue = input.defaultValue;
  if (enumId !== undefined) field.enumId = enumId;
  if (input.comment !== undefined) field.comment = input.comment;
  if (input.check !== undefined) field.check = input.check;
  if (input.generated) field.generated = input.generated;
  return field;
}

function assertUnlocked(run: Run, entity: ErdEntity | undefined | null): void {
  if (entity?.locked) {
    run.fail("invalid_value", `Entity "${entity.name}" is locked and cannot be modified`);
  }
}

function resolveFieldRefs(
  ctx: Context,
  run: Run,
  entityId: string | null,
  refs: readonly OpRef[] | undefined,
): string[] | undefined {
  if (refs === undefined) return undefined;
  if (refs.length > AI_ERD_LIMITS.maxCompositeKeyFields) {
    run.fail(
      "limit_exceeded",
      `A composite key may list at most ${AI_ERD_LIMITS.maxCompositeKeyFields} fields (got ${refs.length})`,
    );
  }
  if (!entityId) return undefined;
  const entity = findEntity(ctx, entityId);
  return refs.flatMap(
    (ref) => resolve(ctx, run, "field", ref, candidates(entity.fields), entityId) ?? [],
  );
}

function checkFieldInput(run: Run, input: ErdOpFieldInput, where: string): void {
  requireName(run, `${where} name`, input.name ?? "");
  requireName(run, `${where} type`, input.type ?? "");
}

function checkEnumValues(run: Run, values: readonly string[]): void {
  if (values.some((value) => value.trim() === "")) {
    run.fail("invalid_value", "Enum values must not be empty");
  }
  if (new Set(values).size !== values.length) {
    run.fail("invalid_value", "Enum values must be unique");
  }
}

function checkOneOf<T extends string>(
  run: Run,
  what: string,
  value: T | undefined,
  allowed: readonly T[],
) {
  if (value !== undefined && !allowed.includes(value)) {
    run.fail("invalid_value", `${what} must be one of ${allowed.join(", ")}`);
  }
}

function singularize(name: string): string {
  const lower = name.trim().toLowerCase();
  if (lower.endsWith("ies") && lower.length > 3) return lower.slice(0, -3) + "y";
  if (/(ses|xes|zes|ches|shes)$/.test(lower)) return lower.slice(0, -2);
  if (lower.endsWith("s") && !lower.endsWith("ss")) return lower.slice(0, -1);
  return lower;
}

function defaultPrimaryKeyName(entityName: string): string {
  return `${singularize(entityName) || "record"}_id`;
}

const HANDLERS: { [N in ErdOpName]: Handler<N> } = {
  addEntity(op, ctx, run) {
    const name = requireName(run, "Entity name", op.name);
    if (name) checkUnique(run, "Entity", name, ctx.doc.entities);
    const localTemps = new Set<string>();
    claimTemp(ctx, run, op.tempId, localTemps);
    const nearId = op.near
      ? resolve(ctx, run, "entity", op.near, candidates(ctx.doc.entities))
      : null;
    const inputs = op.fields ?? [];
    const enumIds = inputs.map((input, i) => {
      checkFieldInput(run, input, `fields[${i}]`);
      const clash = inputs.findIndex(
        (other, j) => j < i && sameName(other.name ?? "", input.name ?? ""),
      );
      if (clash >= 0) run.fail("duplicate_name", `Field "${input.name}" is listed more than once`);
      claimTemp(ctx, run, input.tempId, localTemps);
      return resolveEnum(ctx, run, input.enum);
    });
    if (run.failed()) return;
    const id = ctx.ids.next("entity");
    const fields: ErdField[] =
      inputs.length > 0
        ? inputs.map((input, i) => buildField(ctx.ids.next("field"), input, enumIds[i]))
        : [
            {
              id: ctx.ids.next("field"),
              name: defaultPrimaryKeyName(name),
              type: "integer",
              nullable: false,
              primaryKey: true,
              unique: false,
            },
          ];
    const entity: ErdEntity = {
      id,
      name,
      schema: op.schema ?? "public",
      position: { x: 0, y: 0 },
      fields,
      indexes: [],
    };
    if (op.comment !== undefined) entity.comment = op.comment;
    if (op.color !== undefined) entity.color = op.color;
    if (op.fillColor !== undefined) entity.fillColor = op.fillColor;
    if (op.group !== undefined) entity.group = op.group;
    if (op.locked !== undefined) entity.locked = op.locked;
    ctx.doc.entities.push(entity);
    ctx.placements.push({ kind: "entity", id, nearId });
    if (op.tempId !== undefined) ctx.temps.declare(op.tempId, "entity", id);
    inputs.forEach((input, i) => {
      if (input.tempId !== undefined) {
        ctx.temps.declare(input.tempId, "field", (fields[i] as ErdField).id, id);
      }
    });
  },

  updateEntity(op, ctx, run) {
    const id = resolve(ctx, run, "entity", op.entity, candidates(ctx.doc.entities));
    if (!id) return;
    assertUnlocked(run, findEntity(ctx, id));
    const { patch } = op;
    const name = patch.name !== undefined ? requireName(run, "Entity name", patch.name) : undefined;
    if (name) checkUnique(run, "Entity", name, ctx.doc.entities, id);
    if (run.failed()) return;
    const next: ErdEntity = { ...findEntity(ctx, id) };
    if (name !== undefined) next.name = name;
    if (patch.schema === null) delete next.schema;
    else if (patch.schema !== undefined) next.schema = patch.schema;
    if (patch.comment === null) delete next.comment;
    else if (patch.comment !== undefined) next.comment = patch.comment;
    if (patch.color === null) delete next.color;
    else if (patch.color !== undefined) next.color = patch.color;
    if (patch.fillColor === null) delete next.fillColor;
    else if (patch.fillColor !== undefined) next.fillColor = patch.fillColor;
    if (patch.group === null) delete next.group;
    else if (patch.group !== undefined) next.group = patch.group;
    if (patch.locked !== undefined) next.locked = patch.locked;
    replaceEntity(ctx, next);
  },

  removeEntity(op, ctx, run) {
    const id = resolve(ctx, run, "entity", op.entity, candidates(ctx.doc.entities));
    if (!id) return;
    assertUnlocked(run, findEntity(ctx, id));
    if (run.failed()) return;
    ctx.doc.entities = ctx.doc.entities.filter((entity) => entity.id !== id);
    ctx.doc.relationships = ctx.doc.relationships.filter(
      (rel) => rel.sourceEntityId !== id && rel.targetEntityId !== id,
    );
  },

  addField(op, ctx, run) {
    const entityId = resolve(ctx, run, "entity", op.entity, candidates(ctx.doc.entities));
    checkFieldInput(run, op.field, "Field");
    claimTemp(ctx, run, op.tempId);
    const enumId = resolveEnum(ctx, run, op.field.enum);
    if (!entityId) return;
    const entity = findEntity(ctx, entityId);
    assertUnlocked(run, entity);
    if (op.field.name?.trim()) checkUnique(run, "Field", op.field.name.trim(), entity.fields);
    if (op.index !== undefined && (!Number.isInteger(op.index) || op.index < 0)) {
      run.fail("invalid_value", "index must be a non-negative integer");
    }
    if (run.failed()) return;
    const field = buildField(ctx.ids.next("field"), op.field, enumId);
    const fields = [...entity.fields];
    fields.splice(Math.min(op.index ?? fields.length, fields.length), 0, field);
    replaceEntity(ctx, { ...entity, fields });
    if (op.tempId !== undefined) ctx.temps.declare(op.tempId, "field", field.id, entityId);
  },

  updateField(op, ctx, run) {
    const entityId = resolve(ctx, run, "entity", op.entity, candidates(ctx.doc.entities));
    if (!entityId) return;
    const entity = findEntity(ctx, entityId);
    assertUnlocked(run, entity);
    const fieldId = resolve(ctx, run, "field", op.field, candidates(entity.fields), entityId);
    if (!fieldId) return;
    const { patch } = op;
    const name = patch.name !== undefined ? requireName(run, "Field name", patch.name) : undefined;
    if (name) checkUnique(run, "Field", name, entity.fields, fieldId);
    if (patch.type !== undefined) requireName(run, "Field type", patch.type);
    const enumId = resolveEnum(ctx, run, patch.enum);
    if (run.failed()) return;
    const fields = entity.fields.map((field) => {
      if (field.id !== fieldId) return field;
      const next: ErdField = { ...field };
      if (name !== undefined) next.name = name;
      if (patch.type !== undefined) next.type = patch.type.trim();
      if (patch.length !== undefined) next.length = patch.length;
      if (patch.precision !== undefined) next.precision = patch.precision;
      if (patch.scale !== undefined) next.scale = patch.scale;
      if (patch.nullable !== undefined) next.nullable = patch.nullable;
      if (patch.primaryKey !== undefined) next.primaryKey = patch.primaryKey;
      if (patch.unique !== undefined) next.unique = patch.unique;
      if (patch.defaultValue === null) delete next.defaultValue;
      else if (patch.defaultValue !== undefined) next.defaultValue = patch.defaultValue;
      if (patch.enum === null) delete next.enumId;
      else if (enumId !== undefined) next.enumId = enumId;
      if (patch.comment !== undefined) next.comment = patch.comment;
      if (patch.check !== undefined) next.check = patch.check;
      if (patch.generated === null) delete next.generated;
      else if (patch.generated !== undefined) next.generated = patch.generated;
      return next;
    });
    replaceEntity(ctx, { ...entity, fields });
  },

  removeField(op, ctx, run) {
    const entityId = resolve(ctx, run, "entity", op.entity, candidates(ctx.doc.entities));
    if (!entityId) return;
    const entity = findEntity(ctx, entityId);
    assertUnlocked(run, entity);
    const fieldId = resolve(ctx, run, "field", op.field, candidates(entity.fields), entityId);
    if (!fieldId) return;
    if (run.failed()) return;
    replaceEntity(ctx, {
      ...entity,
      fields: entity.fields.filter((field) => field.id !== fieldId),
      indexes: entity.indexes.map((index) =>
        index.fieldIds.includes(fieldId)
          ? { ...index, fieldIds: index.fieldIds.filter((id) => id !== fieldId) }
          : index,
      ),
    });
    ctx.doc.relationships = ctx.doc.relationships.map((rel) => {
      const source = rel.sourceEntityId === entityId && rel.sourceFieldId === fieldId;
      const target = rel.targetEntityId === entityId && rel.targetFieldId === fieldId;
      if (!source && !target) return rel;
      const next: ErdRelationship = { ...rel };
      if (source) delete next.sourceFieldId;
      if (target) delete next.targetFieldId;
      return next;
    });
  },

  moveField(op, ctx, run) {
    const entityId = resolve(ctx, run, "entity", op.entity, candidates(ctx.doc.entities));
    if (!entityId) return;
    const entity = findEntity(ctx, entityId);
    const fieldId = resolve(ctx, run, "field", op.field, candidates(entity.fields), entityId);
    if (!fieldId) return;
    if (!Number.isInteger(op.toIndex) || op.toIndex < 0) {
      run.fail("invalid_value", "toIndex must be a non-negative integer");
      return;
    }
    const from = entity.fields.findIndex((field) => field.id === fieldId);
    const target = Math.min(op.toIndex, entity.fields.length - 1);
    if (target === from) return;
    const fields = [...entity.fields];
    const [moving] = fields.splice(from, 1);
    fields.splice(target, 0, moving as ErdField);
    replaceEntity(ctx, { ...entity, fields });
  },

  addRelationship(op, ctx, run) {
    const pool = candidates(ctx.doc.entities);
    const sourceId = resolve(ctx, run, "entity", op.source, pool);
    const targetId = resolve(ctx, run, "entity", op.target, pool);
    if (sourceId) assertUnlocked(run, findEntity(ctx, sourceId));
    if (targetId) assertUnlocked(run, findEntity(ctx, targetId));
    claimTemp(ctx, run, op.tempId);
    checkOneOf(run, "cardinality", op.cardinality, CARDINALITIES);
    checkOneOf(run, "onDelete", op.onDelete, ACTIONS);
    checkOneOf(run, "onUpdate", op.onUpdate, ACTIONS);
    const sourceFieldIds = resolveFieldRefs(ctx, run, sourceId, op.sourceFieldIds);
    const targetFieldIds = resolveFieldRefs(ctx, run, targetId, op.targetFieldIds);
    if (
      op.sourceFieldIds !== undefined &&
      op.targetFieldIds !== undefined &&
      op.sourceFieldIds.length !== op.targetFieldIds.length
    ) {
      run.fail(
        "invalid_value",
        `sourceFieldIds and targetFieldIds must have the same length (got ${op.sourceFieldIds.length} and ${op.targetFieldIds.length})`,
      );
    }
    const sourceFieldId =
      sourceId && op.sourceField !== undefined
        ? resolve(
            ctx,
            run,
            "field",
            op.sourceField,
            candidates(findEntity(ctx, sourceId).fields),
            sourceId,
          )
        : undefined;
    const targetFieldId =
      targetId && op.targetField !== undefined
        ? resolve(
            ctx,
            run,
            "field",
            op.targetField,
            candidates(findEntity(ctx, targetId).fields),
            targetId,
          )
        : undefined;
    if (sourceId && targetId) {
      const existing = ctx.doc.relationships.find(
        (rel) =>
          (rel.sourceEntityId === sourceId && rel.targetEntityId === targetId) ||
          (rel.sourceEntityId === targetId && rel.targetEntityId === sourceId),
      );
      if (existing) {
        const sameWay = existing.sourceEntityId === sourceId;
        const knownSource = sameWay ? existing.sourceFieldId : existing.targetFieldId;
        const knownTarget = sameWay ? existing.targetFieldId : existing.sourceFieldId;
        const conflicts =
          (sourceFieldId && knownSource && sourceFieldId !== knownSource) ||
          (targetFieldId && knownTarget && targetFieldId !== knownTarget) ||
          sourceFieldIds !== undefined ||
          targetFieldIds !== undefined;
        if (conflicts) {
          run.fail(
            "invalid_connection",
            `These entities are already related through other fields (${existing.id}); a model keeps one relationship per pair, so change it with updateRelationship`,
          );
        } else if (!run.failed()) {
          const merged: ErdRelationship = { ...existing };
          if (sourceFieldId && !knownSource) {
            if (sameWay) merged.sourceFieldId = sourceFieldId;
            else merged.targetFieldId = sourceFieldId;
          }
          if (targetFieldId && !knownTarget) {
            if (sameWay) merged.targetFieldId = targetFieldId;
            else merged.sourceFieldId = targetFieldId;
          }
          if (!jsonEqual(merged, existing)) {
            ctx.doc.relationships = ctx.doc.relationships.map((rel) =>
              rel.id === existing.id ? merged : rel,
            );
          }
          if (op.tempId !== undefined) ctx.temps.declare(op.tempId, "relationship", existing.id);
          return;
        }
      }
    }
    if (run.failed() || !sourceId || !targetId) return;
    const relationship: ErdRelationship = {
      id: ctx.ids.next("rel"),
      sourceEntityId: sourceId,
      targetEntityId: targetId,
      cardinality: op.cardinality,
      sourceOptional: op.sourceOptional ?? false,
      targetOptional: op.targetOptional ?? true,
      onDelete: op.onDelete ?? "no-action",
      onUpdate: op.onUpdate ?? "no-action",
    };
    if (op.name !== undefined && op.name.trim()) relationship.name = op.name.trim();
    if (sourceFieldId) relationship.sourceFieldId = sourceFieldId;
    if (targetFieldId) relationship.targetFieldId = targetFieldId;
    if (sourceFieldIds) relationship.sourceFieldIds = sourceFieldIds;
    if (targetFieldIds) relationship.targetFieldIds = targetFieldIds;
    inferRelationshipFields(ctx, relationship);
    ctx.doc.relationships.push(relationship);
    if (op.tempId !== undefined) ctx.temps.declare(op.tempId, "relationship", relationship.id);
  },

  updateRelationship(op, ctx, run) {
    const id = resolve(
      ctx,
      run,
      "relationship",
      op.relationship,
      candidates(ctx.doc.relationships),
    );
    if (!id) return;
    const rel = ctx.doc.relationships.find((item) => item.id === id) as ErdRelationship;
    assertUnlocked(run, findEntity(ctx, rel.sourceEntityId));
    assertUnlocked(run, findEntity(ctx, rel.targetEntityId));
    const { patch } = op;
    checkOneOf(run, "cardinality", patch.cardinality, CARDINALITIES);
    checkOneOf(run, "onDelete", patch.onDelete, ACTIONS);
    checkOneOf(run, "onUpdate", patch.onUpdate, ACTIONS);
    const fieldOf = (entityId: string, ref: OpRef | null | undefined) =>
      ref === undefined || ref === null
        ? undefined
        : resolve(ctx, run, "field", ref, candidates(findEntity(ctx, entityId).fields), entityId);
    const sourceFieldId = fieldOf(rel.sourceEntityId, patch.sourceField);
    const targetFieldId = fieldOf(rel.targetEntityId, patch.targetField);
    const sourceFieldIds = resolveFieldRefs(ctx, run, rel.sourceEntityId, patch.sourceFieldIds);
    const targetFieldIds = resolveFieldRefs(ctx, run, rel.targetEntityId, patch.targetFieldIds);
    if (
      patch.sourceFieldIds !== undefined &&
      patch.targetFieldIds !== undefined &&
      patch.sourceFieldIds.length !== patch.targetFieldIds.length
    ) {
      run.fail(
        "invalid_value",
        `sourceFieldIds and targetFieldIds must have the same length (got ${patch.sourceFieldIds.length} and ${patch.targetFieldIds.length})`,
      );
    }
    if (run.failed()) return;
    const next: ErdRelationship = { ...rel };
    if (patch.name !== undefined) {
      if (patch.name.trim()) next.name = patch.name.trim();
      else delete next.name;
    }
    if (patch.cardinality !== undefined) next.cardinality = patch.cardinality;
    if (patch.sourceOptional !== undefined) next.sourceOptional = patch.sourceOptional;
    if (patch.targetOptional !== undefined) next.targetOptional = patch.targetOptional;
    if (patch.onDelete !== undefined) next.onDelete = patch.onDelete;
    if (patch.onUpdate !== undefined) next.onUpdate = patch.onUpdate;
    if (patch.sourceField === null) delete next.sourceFieldId;
    else if (sourceFieldId) next.sourceFieldId = sourceFieldId;
    if (patch.targetField === null) delete next.targetFieldId;
    else if (targetFieldId) next.targetFieldId = targetFieldId;
    if (sourceFieldIds) next.sourceFieldIds = sourceFieldIds;
    if (targetFieldIds) next.targetFieldIds = targetFieldIds;
    ctx.doc.relationships = ctx.doc.relationships.map((item) => (item.id === id ? next : item));
  },

  removeRelationship(op, ctx, run) {
    const id = resolve(
      ctx,
      run,
      "relationship",
      op.relationship,
      candidates(ctx.doc.relationships),
    );
    if (!id) return;
    const rel = ctx.doc.relationships.find((item) => item.id === id) as ErdRelationship;
    assertUnlocked(run, findEntity(ctx, rel.sourceEntityId));
    assertUnlocked(run, findEntity(ctx, rel.targetEntityId));
    if (run.failed()) return;
    ctx.doc.relationships = ctx.doc.relationships.filter((item) => item.id !== id);
  },

  addIndex(op, ctx, run) {
    const entityId = resolve(ctx, run, "entity", op.entity, candidates(ctx.doc.entities));
    claimTemp(ctx, run, op.tempId);
    if (!entityId) return;
    const entity = findEntity(ctx, entityId);
    assertUnlocked(run, entity);
    const fieldIds = resolveIndexFields(ctx, run, entity, op.fields);
    const name =
      op.name?.trim() ||
      nextName(
        `idx_${entity.name}`,
        entity.indexes.map((i) => i.name),
      );
    checkUnique(run, "Index", name, entity.indexes);
    if (run.failed()) return;
    const index: ErdIndex = {
      id: ctx.ids.next("index"),
      name,
      fieldIds,
      unique: op.unique ?? false,
    };
    if (op.method !== undefined) index.method = op.method;
    if (op.where !== undefined) index.where = op.where;
    replaceEntity(ctx, { ...entity, indexes: [...entity.indexes, index] });
    if (op.tempId !== undefined) ctx.temps.declare(op.tempId, "index", index.id, entityId);
  },

  updateIndex(op, ctx, run) {
    const entityId = resolve(ctx, run, "entity", op.entity, candidates(ctx.doc.entities));
    if (!entityId) return;
    const entity = findEntity(ctx, entityId);
    assertUnlocked(run, entity);
    const indexId = resolve(ctx, run, "index", op.index, candidates(entity.indexes), entityId);
    if (!indexId) return;
    const { patch } = op;
    const name = patch.name !== undefined ? requireName(run, "Index name", patch.name) : undefined;
    if (name) checkUnique(run, "Index", name, entity.indexes, indexId);
    const fieldIds = patch.fields ? resolveIndexFields(ctx, run, entity, patch.fields) : undefined;
    if (run.failed()) return;
    replaceEntity(ctx, {
      ...entity,
      indexes: entity.indexes.map((index) =>
        index.id === indexId
          ? {
              ...index,
              ...(name !== undefined ? { name } : {}),
              ...(fieldIds ? { fieldIds } : {}),
              ...(patch.unique !== undefined ? { unique: patch.unique } : {}),
              ...(patch.method !== undefined ? { method: patch.method } : {}),
              ...(patch.where !== undefined ? { where: patch.where } : {}),
            }
          : index,
      ),
    });
  },

  removeIndex(op, ctx, run) {
    const entityId = resolve(ctx, run, "entity", op.entity, candidates(ctx.doc.entities));
    if (!entityId) return;
    const entity = findEntity(ctx, entityId);
    assertUnlocked(run, entity);
    const indexId = resolve(ctx, run, "index", op.index, candidates(entity.indexes), entityId);
    if (!indexId) return;
    if (run.failed()) return;
    replaceEntity(ctx, {
      ...entity,
      indexes: entity.indexes.filter((index) => index.id !== indexId),
    });
  },

  addEnum(op, ctx, run) {
    const name = requireName(run, "Enum name", op.name);
    if (name) checkUnique(run, "Enum", name, ctx.doc.enums);
    checkEnumValues(run, op.values);
    claimTemp(ctx, run, op.tempId);
    if (run.failed()) return;
    const entry: ErdEnum = { id: ctx.ids.next("enum"), name, values: [...op.values] };
    if (op.descriptions !== undefined) entry.descriptions = { ...op.descriptions };
    ctx.doc.enums.push(entry);
    if (op.tempId !== undefined) ctx.temps.declare(op.tempId, "enum", entry.id);
  },

  updateEnum(op, ctx, run) {
    const id = resolve(ctx, run, "enum", op.enum, candidates(ctx.doc.enums));
    if (!id) return;
    const { patch } = op;
    const name = patch.name !== undefined ? requireName(run, "Enum name", patch.name) : undefined;
    if (name) checkUnique(run, "Enum", name, ctx.doc.enums, id);
    if (patch.values) checkEnumValues(run, patch.values);
    if (run.failed()) return;
    ctx.doc.enums = ctx.doc.enums.map((entry) =>
      entry.id === id
        ? {
            ...entry,
            ...(name !== undefined ? { name } : {}),
            ...(patch.values ? { values: [...patch.values] } : {}),
            ...(patch.descriptions !== undefined
              ? { descriptions: { ...patch.descriptions } }
              : {}),
          }
        : entry,
    );
  },

  removeEnum(op, ctx, run) {
    const id = resolve(ctx, run, "enum", op.enum, candidates(ctx.doc.enums));
    if (!id) return;
    ctx.doc.enums = ctx.doc.enums.filter((entry) => entry.id !== id);
    ctx.doc.entities = ctx.doc.entities.map((entity) =>
      entity.fields.some((field) => field.enumId === id)
        ? {
            ...entity,
            fields: entity.fields.map((field) => {
              if (field.enumId !== id) return field;
              const { enumId: _removed, ...rest } = field;
              return rest;
            }),
          }
        : entity,
    );
  },

  addNote(op, ctx, run) {
    claimTemp(ctx, run, op.tempId);
    let nearId: string | null = null;
    if (op.near) {
      const asEntity = resolveRef(op.near, "entity", candidates(ctx.doc.entities), ctx.temps);
      const asNote = asEntity.ok
        ? asEntity
        : resolveRef(op.near, "note", noteCandidates(ctx), ctx.temps);
      if (asNote.ok) nearId = asNote.id;
      else if (!asEntity.ok && asEntity.code === "ambiguous_ref")
        run.fail(asEntity.code, asEntity.message);
      else run.fail(asNote.code, `Unknown entity or note "${op.near}"`);
    }
    if (run.failed()) return;
    const note: ErdNote = {
      id: ctx.ids.next("note"),
      text: op.text,
      position: { x: 0, y: 0 },
      width: NOTE_DEFAULT_SIZE.width,
      height: NOTE_DEFAULT_SIZE.height,
    };
    if (op.color !== undefined) note.color = op.color;
    if (op.titleColor !== undefined) note.titleColor = op.titleColor;
    ctx.doc.notes.push(note);
    ctx.placements.push({ kind: "note", id: note.id, nearId });
    if (op.tempId !== undefined) ctx.temps.declare(op.tempId, "note", note.id);
  },

  updateNote(op, ctx, run) {
    const id = resolve(ctx, run, "note", op.note, noteCandidates(ctx));
    if (!id) return;
    ctx.doc.notes = ctx.doc.notes.map((note) =>
      note.id === id
        ? {
            ...note,
            ...(op.patch.text !== undefined ? { text: op.patch.text } : {}),
            ...(op.patch.color !== undefined ? { color: op.patch.color } : {}),
            ...(op.patch.titleColor !== undefined ? { titleColor: op.patch.titleColor } : {}),
          }
        : note,
    );
  },

  removeNote(op, ctx, run) {
    const id = resolve(ctx, run, "note", op.note, noteCandidates(ctx));
    if (!id) return;
    ctx.doc.notes = ctx.doc.notes.filter((note) => note.id !== id);
  },

  setEngine(op, ctx, run) {
    checkOneOf(run, "engine", op.engine, DATA_MODEL_ENGINES);
    if (run.failed()) return;
    ctx.doc.engine = op.engine;
  },

  setModelName(op, ctx, run) {
    const name = typeof op.name === "string" ? op.name.trim() : "";
    if (!name) run.fail("invalid_value", "name must not be empty");
    if (name.length > 120) run.fail("invalid_value", "name is too long");
    if (run.failed()) return;
    ctx.doc.meta = { ...ctx.doc.meta, name };
  },

  setModelDescription(op, ctx, run) {
    const description = typeof op.description === "string" ? op.description.trim() : "";
    if (!description) run.fail("invalid_value", "description must not be empty");
    if (description.length > 4000) run.fail("invalid_value", "description is too long");
    if (run.failed()) return;
    ctx.doc.meta = { ...ctx.doc.meta, description };
  },

  autoLayout(op, ctx, run) {
    const mode = op.mode ?? "layered";
    checkOneOf(run, "mode", mode, ["grid", "layered"] as const);
    if (run.failed()) return;
    layoutEntities(ctx, mode);
  },
};

function layoutEntities(ctx: Context, mode: "grid" | "layered"): void {
  const positions = layoutErd(mode, ctx.doc.entities, ctx.doc.relationships, (entity) => {
    const { width, height } = getEntityRect(entity);
    return { width, height };
  });
  ctx.doc.entities = ctx.doc.entities.map((entity) => {
    const position = positions[entity.id];
    return position ? { ...entity, position: { ...position } } : entity;
  });
  ctx.placements = ctx.placements.filter((placement) => placement.kind === "note");
  ctx.laidOut = true;
}

function shouldAutoLayout(ctx: Context, before: ErdDocumentJSON): boolean {
  if (ctx.laidOut) return false;
  const existing = new Set(before.entities.map((entity) => entity.id));
  if (existing.size > AUTO_LAYOUT_MAX_EXISTING) return false;
  const added = ctx.doc.entities.filter((entity) => !existing.has(entity.id)).length;
  return added >= (existing.size === 0 ? 1 : AUTO_LAYOUT_MIN_ADDED);
}

function noteCandidates(ctx: Context): RefCandidate[] {
  return ctx.doc.notes.map((note) => ({ id: note.id, name: note.text }));
}

function resolveIndexFields(
  ctx: Context,
  run: Run,
  entity: ErdEntity,
  refs: readonly OpRef[],
): string[] {
  if (refs.length === 0) run.fail("invalid_value", "An index needs at least one field");
  const ids = refs.flatMap(
    (ref) => resolve(ctx, run, "field", ref, candidates(entity.fields), entity.id) ?? [],
  );
  if (new Set(ids).size !== ids.length) run.fail("invalid_value", "An index lists a field twice");
  return ids;
}

function declaredTemps(op: ErdOp): { tempId: string; kind: RefKind }[] {
  const out: { tempId: string; kind: RefKind }[] = [];
  const add = (tempId: string | undefined, kind: RefKind) => {
    if (tempId !== undefined) out.push({ tempId, kind });
  };
  switch (op.op) {
    case "addEntity":
      add(op.tempId, "entity");
      op.fields?.forEach((field) => add(field.tempId, "field"));
      break;
    case "addField":
      add(op.tempId, "field");
      break;
    case "addRelationship":
      add(op.tempId, "relationship");
      break;
    case "addIndex":
      add(op.tempId, "index");
      break;
    case "addEnum":
      add(op.tempId, "enum");
      break;
    case "addNote":
      add(op.tempId, "note");
      break;
    default:
      break;
  }
  return out;
}

function inferRelationshipFields(ctx: Context, relationship: ErdRelationship): void {
  if (relationship.cardinality === "many-to-many") return;
  if (relationship.sourceFieldIds?.length || relationship.targetFieldIds?.length) return;
  let source = findEntity(ctx, relationship.sourceEntityId);
  let target = findEntity(ctx, relationship.targetEntityId);
  if (
    !relationship.sourceFieldId &&
    !relationship.targetFieldId &&
    !holdsReference(target, source) &&
    holdsReference(source, target)
  ) {
    [source, target] = [target, source];
    relationship.sourceEntityId = source.id;
    relationship.targetEntityId = target.id;
  }
  const keyField = relationship.sourceFieldId
    ? source.fields.find((field) => field.id === relationship.sourceFieldId)
    : undefined;
  const keys = keyField ? [keyField] : referenceKey(source);
  if (keys.length !== 1) return;
  const key = keys[0] as ErdField;
  relationship.sourceFieldId ??= key.id;
  if (!relationship.targetFieldId) {
    const column = findReferenceColumn(target, source, key);
    if (column) relationship.targetFieldId = column.id;
  }
}

function relatedPlaced(
  ctx: Context,
  entityId: string,
  placed: ReadonlyMap<string, Rect>,
): { rect: Rect; isChild: boolean } | null {
  for (const relationship of ctx.doc.relationships) {
    if (relationship.sourceEntityId === relationship.targetEntityId) continue;
    if (relationship.targetEntityId === entityId) {
      const rect = placed.get(relationship.sourceEntityId);
      if (rect) return { rect, isChild: true };
    }
    if (relationship.sourceEntityId === entityId) {
      const rect = placed.get(relationship.targetEntityId);
      if (rect) return { rect, isChild: false };
    }
  }
  return null;
}

function placeNewObjects(ctx: Context): void {
  const pending = new Set(ctx.placements.map((placement) => placement.id));
  const entityRects = new Map<string, Rect>();
  for (const entity of ctx.doc.entities) {
    if (!pending.has(entity.id)) entityRects.set(entity.id, getEntityRect(entity));
  }
  const obstacles: Rect[] = [...entityRects.values()];
  for (const placement of ctx.placements) {
    if (placement.kind !== "entity") continue;
    const entity = ctx.doc.entities.find((item) => item.id === placement.id);
    if (!entity) continue;
    const size = { width: entity.width ?? ENTITY_DEFAULT_WIDTH, height: entityHeight(entity) };
    const near = placement.nearId !== null ? entityRects.get(placement.nearId) : undefined;
    const related = near ? null : relatedPlaced(ctx, entity.id, entityRects);
    const anchor = near ?? related?.rect ?? rightMost([...entityRects.values()]);
    const start = !anchor
      ? { x: 0, y: 0 }
      : related && !related.isChild
        ? { x: anchor.x - size.width - GRID_GAP, y: anchor.y }
        : { x: anchor.x + anchor.width + GRID_GAP, y: anchor.y };
    const position = avoidOverlap(start, size, obstacles, GRID_GAP);
    const rect = { ...position, ...size };
    obstacles.push(rect);
    entity.position = position;
    entityRects.set(entity.id, rect);
  }
  const newNotes = ctx.placements.filter((placement) => placement.kind === "note");
  if (newNotes.length > 0 || ctx.laidOut) arrangeNotes(ctx, [...entityRects.values()], newNotes);
  ctx.placements = [];
}

function arrangeNotes(
  ctx: Context,
  entityRects: readonly Rect[],
  added: readonly { id: string }[],
): void {
  const addedIds = new Set(added.map((placement) => placement.id));
  const existing = readingOrder(ctx.doc.notes.filter((note) => !addedIds.has(note.id)));
  const fresh = added
    .map((placement) => ctx.doc.notes.find((note) => note.id === placement.id))
    .filter((note): note is ErdNote => note !== undefined);
  const positions = layoutNotesBelow(entityRects, [...existing, ...fresh]);
  ctx.doc.notes = ctx.doc.notes.map((note) => {
    const position = positions[note.id];
    return position ? { ...note, position: { ...position } } : note;
  });
}

function limitErrors(doc: ErdDocumentJSON): OpError[] {
  const errors: OpError[] = [];
  const push = (message: string) =>
    errors.push({ index: -1, op: "", code: "limit_exceeded", message });
  if (doc.entities.length > AI_ERD_LIMITS.maxEntities) {
    push(
      `A data model may have at most ${AI_ERD_LIMITS.maxEntities} entities (would have ${doc.entities.length})`,
    );
  }
  for (const entity of doc.entities) {
    if (entity.fields.length > AI_ERD_LIMITS.maxFieldsPerEntity) {
      push(
        `Entity "${entity.name}" may have at most ${AI_ERD_LIMITS.maxFieldsPerEntity} fields (would have ${entity.fields.length})`,
      );
    }
  }
  if (doc.relationships.length > AI_ERD_LIMITS.maxRelationships) {
    push(
      `A data model may have at most ${AI_ERD_LIMITS.maxRelationships} relationships (would have ${doc.relationships.length})`,
    );
  }
  return errors;
}

function newIssues(before: ErdDocumentJSON, after: ErdDocumentJSON): string[] {
  const key = (issue: { code: string; message: string }) => `${issue.code}|${issue.message}`;
  const known = new Set(validateErd(before).issues.map(key));
  return validateErd(after)
    .issues.filter((issue) => !known.has(key(issue)))
    .map((issue) => `${issue.severity}: ${issue.message}`);
}

function collectIds(doc: ErdDocumentJSON): string[] {
  return [
    ...doc.entities.flatMap((entity) => [
      entity.id,
      ...entity.fields.map((field) => field.id),
      ...entity.indexes.map((index) => index.id),
    ]),
    ...doc.relationships.map((rel) => rel.id),
    ...doc.enums.map((entry) => entry.id),
    ...doc.notes.map((note) => note.id),
  ];
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

function runOps(ctx: Context, ops: readonly ErdOp[], errors: OpError[]): void {
  ops.forEach((op, index) => {
    const opErrors: OpError[] = [];
    const name = typeof op?.op === "string" ? op.op : "";
    const run: Run = {
      fail: (code, message) => opErrors.push({ index, op: name, code, message }),
      failed: () => opErrors.length > 0,
    };
    const handler = Object.prototype.hasOwnProperty.call(HANDLERS, name)
      ? (HANDLERS[name as ErdOpName] as (op: ErdOp, ctx: Context, run: Run) => void)
      : null;
    if (!handler) {
      run.fail("unknown_op", `Unknown op "${name}"`);
    } else {
      try {
        handler(op, ctx, run);
      } catch (err) {
        run.fail("invalid_shape", errorMessage(err));
      }
    }
    if (opErrors.length > 0) {
      errors.push(...opErrors);
      if (handler) {
        for (const temp of declaredTemps(op)) ctx.temps.poison(temp.tempId, temp.kind, index);
      }
    }
  });
}

function opLimitError(count: number): OpError | null {
  if (count <= AI_ERD_LIMITS.maxOpsPerBatch) return null;
  return {
    index: -1,
    op: "",
    code: "limit_exceeded",
    message: `A batch may contain at most ${AI_ERD_LIMITS.maxOpsPerBatch} ops (got ${count})`,
  };
}

export function applyErdOps(
  input: ErdDocumentJSON,
  ops: readonly ErdOp[],
  options: ApplyOpsOptions = {},
): ApplyOpsResult<ErdDocumentJSON> {
  let before: ErdDocumentJSON;
  try {
    before = parseErdDocument(cloneJson(input));
  } catch (err) {
    return {
      ok: false,
      errors: [
        {
          index: -1,
          op: "",
          code: "invalid_value",
          message: `The current document is invalid: ${errorMessage(err)}`,
        },
      ],
    };
  }
  const errors: OpError[] = [];
  const tooMany = opLimitError(ops.length);
  if (tooMany) errors.push(tooMany);
  const ctx: Context = {
    doc: cloneJson(before),
    temps: new TempIds(),
    ids: new IdFactory(options.createId ?? createId, collectIds(before)),
    placements: [],
    warnings: [],
    laidOut: false,
  };
  runOps(ctx, ops, errors);
  if (errors.length === 0 && shouldAutoLayout(ctx, before)) layoutEntities(ctx, "layered");
  placeNewObjects(ctx);
  errors.push(...limitErrors(ctx.doc));
  if (errors.length > 0) return { ok: false, errors };
  let document: ErdDocumentJSON;
  try {
    document = parseErdDocument(cloneJson(ctx.doc));
  } catch (err) {
    return {
      ok: false,
      errors: [
        {
          index: -1,
          op: "",
          code: "invalid_value",
          message: `The result is not a valid data model: ${errorMessage(err)}`,
        },
      ],
    };
  }
  return {
    ok: true,
    document,
    idMap: ctx.temps.toIdMap(),
    diff: diffErd(before, document),
    warnings: [...ctx.warnings, ...newIssues(before, document)],
  };
}

export interface ErdDraft {
  before: ErdDocumentJSON;
  doc: ErdDocumentJSON;
  temps: TempIds;
  placements: readonly Placement[];
  slots: number;
  count: number;
  laidOut: boolean;
  deferLayout: boolean;
}

export type ErdDraftStep =
  { ok: true; draft: ErdDraft; diff: DocDiff } | { ok: false; errors: OpError[] };

const DRAFT_COLUMNS = 4;
const DRAFT_ROW_HEIGHT = 320;

export function startErdDraft(input: ErdDocumentJSON): ErdDraft {
  return {
    before: input,
    doc: input,
    temps: new TempIds(),
    placements: [],
    slots: 0,
    count: 0,
    laidOut: false,
    deferLayout: input.entities.length <= AUTO_LAYOUT_MAX_EXISTING,
  };
}

function draftContext(draft: ErdDraft, createIdFn: (prefix: string) => string): Context {
  const { doc } = draft;
  return {
    doc: {
      ...doc,
      entities: [...doc.entities],
      relationships: [...doc.relationships],
      enums: [...doc.enums],
      notes: [...doc.notes],
    },
    temps: draft.temps.clone(),
    ids: new IdFactory(createIdFn, collectIds(doc)),
    placements: [...draft.placements],
    warnings: [],
    laidOut: draft.laidOut,
  };
}

function placeDraftObjects(ctx: Context, fresh: readonly Placement[], firstSlot: number): void {
  if (fresh.length === 0) return;
  const pending = new Set(fresh.map((placement) => placement.id));
  const obstacles: Rect[] = [
    ...ctx.doc.entities.filter((entity) => !pending.has(entity.id)).map(getEntityRect),
    ...ctx.doc.notes.filter((note) => !pending.has(note.id)).map(getNoteRect),
  ];
  fresh.forEach((placement, offset) => {
    const entity =
      placement.kind === "entity"
        ? ctx.doc.entities.find((item) => item.id === placement.id)
        : undefined;
    const note =
      placement.kind === "note"
        ? ctx.doc.notes.find((item) => item.id === placement.id)
        : undefined;
    if (!entity && !note) return;
    const size = entity
      ? { width: entity.width ?? ENTITY_DEFAULT_WIDTH, height: entityHeight(entity) }
      : { width: (note as ErdNote).width, height: (note as ErdNote).height };
    const slot = firstSlot + offset;
    const start = {
      x: (slot % DRAFT_COLUMNS) * (ENTITY_DEFAULT_WIDTH + GRID_GAP * 2),
      y: Math.floor(slot / DRAFT_COLUMNS) * DRAFT_ROW_HEIGHT,
    };
    const position = avoidOverlap(start, size, obstacles, GRID_GAP);
    obstacles.push({ ...position, ...size });
    if (entity) entity.position = position;
    else if (note) note.position = position;
  });
}

export function applyErdDraftOps(
  draft: ErdDraft,
  ops: readonly ErdOp[],
  options: ApplyOpsOptions = {},
): ErdDraftStep {
  const errors: OpError[] = [];
  const tooMany = opLimitError(draft.count + ops.length);
  if (tooMany) return { ok: false, errors: [tooMany] };
  const ctx = draftContext(draft, options.createId ?? createId);
  runOps(ctx, ops, errors);
  if (errors.length > 0) return { ok: false, errors };
  let slots = draft.slots;
  const known = new Set(draft.placements.map((placement) => placement.id));
  const placements = ctx.placements;
  const fresh = placements.filter((placement) => !known.has(placement.id));
  if (draft.deferLayout) {
    placeDraftObjects(ctx, fresh, slots);
    slots += fresh.length;
  } else {
    ctx.placements = fresh;
    placeNewObjects(ctx);
  }
  const limits = limitErrors(ctx.doc);
  if (limits.length > 0) return { ok: false, errors: limits };
  return {
    ok: true,
    draft: {
      ...draft,
      doc: ctx.doc,
      temps: ctx.temps,
      placements,
      slots,
      count: draft.count + ops.length,
      laidOut: ctx.laidOut,
    },
    diff: diffErd(draft.doc, ctx.doc),
  };
}

const samePosition = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  a.x === b.x && a.y === b.y;

export function finishErdDraft(draft: ErdDraft): ApplyOpsResult<ErdDocumentJSON> {
  let document = draft.doc;
  if (draft.placements.length > 0) {
    const pending = new Set(draft.placements.map((placement) => placement.id));
    const ctx: Context = {
      doc: {
        ...document,
        entities: document.entities.map((entity) =>
          pending.has(entity.id) ? { ...entity } : entity,
        ),
        notes: document.notes.map((note) => (pending.has(note.id) ? { ...note } : note)),
      },
      temps: draft.temps,
      ids: new IdFactory(createId, []),
      placements: [...draft.placements],
      warnings: [],
      laidOut: draft.laidOut,
    };
    if (shouldAutoLayout(ctx, draft.before)) layoutEntities(ctx, "layered");
    placeNewObjects(ctx);
    const entities = new Map(document.entities.map((entity) => [entity.id, entity]));
    const notes = new Map(document.notes.map((note) => [note.id, note]));
    document = {
      ...ctx.doc,
      entities: ctx.doc.entities.map((entity) => {
        const original = entities.get(entity.id);
        return original && samePosition(original.position, entity.position) ? original : entity;
      }),
      notes: ctx.doc.notes.map((note) => {
        const original = notes.get(note.id);
        return original && samePosition(original.position, note.position) ? original : note;
      }),
    };
  }
  try {
    parseErdDocument(document);
  } catch (err) {
    return {
      ok: false,
      errors: [
        {
          index: -1,
          op: "",
          code: "invalid_value",
          message: `The result is not a valid data model: ${errorMessage(err)}`,
        },
      ],
    };
  }
  return {
    ok: true,
    document,
    idMap: draft.temps.toIdMap(),
    diff: diffErd(draft.before, document),
    warnings: newIssues(draft.before, document),
  };
}

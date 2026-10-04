import type {
  DataModelEngine,
  ErdEntity,
  ErdEnum,
  ErdField,
  ErdRelationship,
} from "../../types/dataModel.types";
import type { ErdSnapshot } from "./erdEngine";
import { needsLength, needsPrecision, normalizeType, typeCatalogFor } from "./erdTypes";

export type ErdIssueSeverity = "error" | "warning";

export type ErdIssueCode =
  | "duplicate-entity-name"
  | "empty-entity-name"
  | "empty-field-name"
  | "duplicate-field-name"
  | "entity-without-pk"
  | "entity-without-fields"
  | "dangling-relationship"
  | "empty-enum"
  | "duplicate-enum-value"
  | "duplicate-enum-name"
  | "missing-enum"
  | "index-missing-field"
  | "index-without-fields"
  | "duplicate-index-name"
  | "invalid-identifier"
  | "empty-model"
  | "reserved-word"
  | "name-too-long"
  | "mixed-naming-style"
  | "unsupported-type"
  | "missing-length"
  | "invalid-length"
  | "invalid-precision"
  | "primary-key-nullable"
  | "relationship-missing-field"
  | "relationship-type-mismatch"
  | "referenced-field-not-unique"
  | "duplicate-relationship"
  | "many-to-many-without-join-table"
  | "foreign-key-without-index"
  | "self-relationship"
  | "orphan-entity"
  | "unused-enum"
  | "circular-relationship"
  | "generated-default-conflict"
  | "composite-key-length-mismatch";

export interface ErdValidationIssue {
  id: string;
  code: ErdIssueCode;
  severity: ErdIssueSeverity;
  message: string;
  hint?: string;
  entityId?: string;
  fieldId?: string;
  relationshipId?: string;
  enumId?: string;
  indexId?: string;
}

export interface ErdValidationResult {
  valid: boolean;
  issues: ErdValidationIssue[];
  errorCount: number;
  warningCount: number;
}

type IssueDraft = Omit<ErdValidationIssue, "id">;

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

const normalizeName = (value: string) => value.trim().toLowerCase();
const isBlank = (value: string) => value.trim() === "";
const quoted = (value: string) => `"${value}"`;

function duplicatesBy<T>(items: readonly T[], keyOf: (item: T) => string): T[][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

function entityKey(entity: ErdEntity): string {
  return `${normalizeName(entity.schema ?? "")}.${normalizeName(entity.name)}`;
}

function entityIssues(entities: readonly ErdEntity[]): IssueDraft[] {
  const named = entities.filter((entity) => !isBlank(entity.name));
  const issues: IssueDraft[] = [];
  for (const group of duplicatesBy(named, entityKey)) {
    for (const entity of group) {
      issues.push({
        code: "duplicate-entity-name",
        severity: "error",
        message: `Entity name ${quoted(entity.name)} is used more than once`,
        entityId: entity.id,
      });
    }
  }
  for (const entity of entities) {
    if (isBlank(entity.name)) {
      issues.push({
        code: "empty-entity-name",
        severity: "error",
        message: "An entity has no name",
        entityId: entity.id,
      });
    } else if (!IDENTIFIER.test(entity.name)) {
      issues.push({
        code: "invalid-identifier",
        severity: "warning",
        message: `Entity name ${quoted(entity.name)} is not a plain SQL identifier`,
        entityId: entity.id,
      });
    }
    if (entity.fields.length === 0) {
      issues.push({
        code: "entity-without-fields",
        severity: "warning",
        message: `Entity ${quoted(entity.name)} has no fields`,
        entityId: entity.id,
      });
    } else if (!entity.fields.some((field) => field.primaryKey)) {
      issues.push({
        code: "entity-without-pk",
        severity: "warning",
        message: `Entity ${quoted(entity.name)} has no primary key`,
        entityId: entity.id,
      });
    }
  }
  return issues;
}

function fieldIssues(entity: ErdEntity): IssueDraft[] {
  const issues: IssueDraft[] = [];
  const named = entity.fields.filter((field) => !isBlank(field.name));
  for (const group of duplicatesBy(named, (field) => normalizeName(field.name))) {
    for (const field of group) {
      issues.push({
        code: "duplicate-field-name",
        severity: "error",
        message: `Field ${quoted(field.name)} is declared more than once in ${quoted(entity.name)}`,
        entityId: entity.id,
        fieldId: field.id,
      });
    }
  }
  for (const field of entity.fields) {
    if (isBlank(field.name)) {
      issues.push({
        code: "empty-field-name",
        severity: "error",
        message: `A field in ${quoted(entity.name)} has no name`,
        entityId: entity.id,
        fieldId: field.id,
      });
    } else if (!IDENTIFIER.test(field.name)) {
      issues.push({
        code: "invalid-identifier",
        severity: "warning",
        message: `Field name ${quoted(field.name)} in ${quoted(entity.name)} is not a plain SQL identifier`,
        entityId: entity.id,
        fieldId: field.id,
      });
    }
  }
  return issues;
}

function indexIssues(entity: ErdEntity): IssueDraft[] {
  const issues: IssueDraft[] = [];
  const fieldIds = new Set(entity.fields.map((field) => field.id));
  for (const index of entity.indexes) {
    if (index.fieldIds.length === 0) {
      issues.push({
        code: "index-without-fields",
        severity: "warning",
        message: `Index ${quoted(index.name)} on ${quoted(entity.name)} has no fields`,
        entityId: entity.id,
        indexId: index.id,
      });
    }
    if (index.fieldIds.some((id) => !fieldIds.has(id))) {
      issues.push({
        code: "index-missing-field",
        severity: "error",
        message: `Index ${quoted(index.name)} on ${quoted(entity.name)} references a missing field`,
        entityId: entity.id,
        indexId: index.id,
      });
    }
    if (!isBlank(index.name) && !IDENTIFIER.test(index.name)) {
      issues.push({
        code: "invalid-identifier",
        severity: "warning",
        message: `Index name ${quoted(index.name)} is not a plain SQL identifier`,
        entityId: entity.id,
        indexId: index.id,
      });
    }
  }
  const named = entity.indexes.filter((index) => !isBlank(index.name));
  for (const group of duplicatesBy(named, (index) => normalizeName(index.name))) {
    for (const index of group) {
      issues.push({
        code: "duplicate-index-name",
        severity: "warning",
        message: `Index name ${quoted(index.name)} is used more than once on ${quoted(entity.name)}`,
        entityId: entity.id,
        indexId: index.id,
      });
    }
  }
  return issues;
}

function fieldEnumIssues(entity: ErdEntity, enumIds: ReadonlySet<string>): IssueDraft[] {
  return entity.fields
    .filter((field) => field.enumId !== undefined && !enumIds.has(field.enumId))
    .map((field) => ({
      code: "missing-enum" as const,
      severity: "error" as const,
      message: `Field ${quoted(field.name)} in ${quoted(entity.name)} uses an enum that does not exist`,
      entityId: entity.id,
      fieldId: field.id,
    }));
}

function generatedDefaultIssues(entity: ErdEntity): IssueDraft[] {
  return entity.fields
    .filter((field) => field.generated !== undefined && field.defaultValue !== undefined)
    .map((field) => ({
      code: "generated-default-conflict" as const,
      severity: "error" as const,
      message: `Field ${quoted(field.name)} in ${quoted(entity.name)} cannot have both a generated expression and a default value`,
      hint: "Remove one of them.",
      entityId: entity.id,
      fieldId: field.id,
    }));
}

function unusedEnumIssues(enums: readonly ErdEnum[], entities: readonly ErdEntity[]): IssueDraft[] {
  const used = new Set(
    entities.flatMap((entity) => entity.fields.flatMap((field) => field.enumId ?? [])),
  );
  return enums
    .filter((entry) => !used.has(entry.id))
    .map((entry) => ({
      code: "unused-enum" as const,
      severity: "warning" as const,
      message: `Enum ${quoted(entry.name)} is not used by any field`,
      hint: "Remove it, or use it on a field.",
      enumId: entry.id,
    }));
}

function compositeKeyIssues(relationship: ErdRelationship): IssueDraft[] {
  const { sourceFieldIds, targetFieldIds } = relationship;
  if (!sourceFieldIds || !targetFieldIds) return [];
  if (sourceFieldIds.length === targetFieldIds.length) return [];
  return [
    {
      code: "composite-key-length-mismatch",
      severity: "error",
      message: `Relationship ${relationship.id} has ${sourceFieldIds.length} source columns but ${targetFieldIds.length} target columns`,
      hint: "Composite foreign keys must pair up one-to-one.",
      relationshipId: relationship.id,
    },
  ];
}

function circularRelationshipIssues(
  snapshot: ErdSnapshot,
  entityLookup: ReadonlyMap<string, ErdEntity>,
): IssueDraft[] {
  type Edge = { to: string; relationship: ErdRelationship };
  const edges = new Map<string, Edge[]>();
  for (const relationship of snapshot.relationships) {
    if (relationship.sourceEntityId === relationship.targetEntityId) continue;
    if (
      !entityLookup.has(relationship.sourceEntityId) ||
      !entityLookup.has(relationship.targetEntityId)
    ) {
      continue;
    }
    const list = edges.get(relationship.sourceEntityId) ?? [];
    list.push({ to: relationship.targetEntityId, relationship });
    edges.set(relationship.sourceEntityId, list);
  }
  const issues: IssueDraft[] = [];
  const seenCycles = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];
  const pathEdges: ErdRelationship[] = [];
  const onPath = new Set<string>();

  const visit = (entityId: string): void => {
    path.push(entityId);
    onPath.add(entityId);
    for (const edge of edges.get(entityId) ?? []) {
      if (onPath.has(edge.to)) {
        const startIndex = path.indexOf(edge.to);
        const cycleIds = path.slice(startIndex);
        const key = [...cycleIds].sort().join("|");
        if (!seenCycles.has(key)) {
          seenCycles.add(key);
          const names = cycleIds.map((id) => quoted(entityLookup.get(id)?.name ?? id)).join(", ");
          issues.push({
            code: "circular-relationship",
            severity: "warning",
            message: `Entities ${names} form a circular relationship chain`,
            hint: "Circular foreign keys can make inserts and deletes order-dependent — confirm this is intentional.",
            relationshipId: (pathEdges[startIndex] ?? edge.relationship).id,
          });
        }
        continue;
      }
      if (!visited.has(edge.to)) {
        pathEdges.push(edge.relationship);
        visit(edge.to);
        pathEdges.pop();
      }
    }
    path.pop();
    onPath.delete(entityId);
    visited.add(entityId);
  };

  for (const entity of snapshot.entities) {
    if (!visited.has(entity.id)) visit(entity.id);
  }
  return issues;
}

function enumIssues(enums: readonly ErdEnum[]): IssueDraft[] {
  const issues: IssueDraft[] = [];
  const named = enums.filter((entry) => !isBlank(entry.name));
  for (const group of duplicatesBy(named, (entry) => normalizeName(entry.name))) {
    for (const entry of group) {
      issues.push({
        code: "duplicate-enum-name",
        severity: "error",
        message: `Enum name ${quoted(entry.name)} is used more than once`,
        enumId: entry.id,
      });
    }
  }
  for (const entry of enums) {
    if (entry.values.length === 0) {
      issues.push({
        code: "empty-enum",
        severity: "warning",
        message: `Enum ${quoted(entry.name)} has no values`,
        enumId: entry.id,
      });
    }
    if (new Set(entry.values).size !== entry.values.length) {
      issues.push({
        code: "duplicate-enum-value",
        severity: "error",
        message: `Enum ${quoted(entry.name)} repeats a value`,
        enumId: entry.id,
      });
    }
    if (!isBlank(entry.name) && !IDENTIFIER.test(entry.name)) {
      issues.push({
        code: "invalid-identifier",
        severity: "warning",
        message: `Enum name ${quoted(entry.name)} is not a plain SQL identifier`,
        enumId: entry.id,
      });
    }
  }
  return issues;
}

function relationshipIssues(
  relationship: ErdRelationship,
  entityLookup: ReadonlyMap<string, ErdEntity>,
): IssueDraft[] {
  if (
    entityLookup.has(relationship.sourceEntityId) &&
    entityLookup.has(relationship.targetEntityId)
  ) {
    return [];
  }
  return [
    {
      code: "dangling-relationship",
      severity: "error",
      message: "A relationship points to an entity that no longer exists",
      relationshipId: relationship.id,
    },
  ];
}

const RESERVED_WORDS: ReadonlySet<string> = new Set([
  "all",
  "alter",
  "and",
  "any",
  "as",
  "asc",
  "between",
  "by",
  "case",
  "check",
  "column",
  "constraint",
  "create",
  "default",
  "delete",
  "desc",
  "distinct",
  "drop",
  "else",
  "end",
  "exists",
  "false",
  "for",
  "foreign",
  "from",
  "grant",
  "group",
  "having",
  "in",
  "index",
  "insert",
  "into",
  "is",
  "join",
  "key",
  "like",
  "limit",
  "not",
  "null",
  "offset",
  "on",
  "or",
  "order",
  "primary",
  "references",
  "select",
  "set",
  "table",
  "then",
  "to",
  "true",
  "union",
  "unique",
  "update",
  "user",
  "using",
  "values",
  "when",
  "where",
  "with",
]);

const MAX_NAME_LENGTH: Record<DataModelEngine, number> = {
  na: 128,
  postgres: 63,
  mysql: 64,
  sqlite: 128,
};

const ENGINE_LABELS: Record<DataModelEngine, string> = {
  na: "this model",
  postgres: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
};

type NamingStyle = "snake" | "camel" | "pascal" | "upper" | "other";

function namingStyle(name: string): NamingStyle {
  if (!IDENTIFIER.test(name)) return "other";
  if (/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(name)) return "snake";
  if (/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(name) && name.length > 1) return "upper";
  if (/^[a-z]+[A-Za-z0-9]*[A-Z][A-Za-z0-9]*$/.test(name)) return "camel";
  if (/^[A-Z][a-z0-9]+([A-Z][a-z0-9]*)*$/.test(name)) return "pascal";
  return "other";
}

const STYLE_LABELS: Record<NamingStyle, string> = {
  snake: "snake_case",
  camel: "camelCase",
  pascal: "PascalCase",
  upper: "UPPER_CASE",
  other: "mixed",
};

function modelIssues(snapshot: ErdSnapshot): IssueDraft[] {
  const issues: IssueDraft[] = [];
  if (snapshot.entities.length === 0) {
    issues.push({
      code: "empty-model",
      severity: "warning",
      message: "The data model has no entities yet",
      hint: "Add an entity from the palette, or ask AI to generate one.",
    });
    return issues;
  }
  const named = snapshot.entities.filter((entity) => IDENTIFIER.test(entity.name));
  const counts = new Map<NamingStyle, number>();
  for (const entity of named) {
    const style = namingStyle(entity.name);
    counts.set(style, (counts.get(style) ?? 0) + 1);
  }
  if (counts.size > 1) {
    const [dominant] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    for (const entity of named) {
      const style = namingStyle(entity.name);
      if (dominant && style !== dominant) {
        issues.push({
          code: "mixed-naming-style",
          severity: "warning",
          message: `Entity ${quoted(entity.name)} is ${STYLE_LABELS[style]} but most entities use ${STYLE_LABELS[dominant]}`,
          hint: "Keep one naming style across the model.",
          entityId: entity.id,
        });
      }
    }
  }
  return issues;
}

function nameRuleIssues(snapshot: ErdSnapshot): IssueDraft[] {
  const limit = MAX_NAME_LENGTH[snapshot.engine];
  const issues: IssueDraft[] = [];
  const check = (
    name: string,
    base: Omit<IssueDraft, "code" | "severity" | "message">,
    label: string,
  ) => {
    if (isBlank(name)) return;
    if (RESERVED_WORDS.has(normalizeName(name))) {
      issues.push({
        ...base,
        code: "reserved-word",
        severity: "warning",
        message: `${label} ${quoted(name)} is a reserved SQL word`,
        hint: "Rename it, or it must always be quoted in SQL.",
      });
    }
    if (name.length > limit) {
      issues.push({
        ...base,
        code: "name-too-long",
        severity: "error",
        message: `${label} ${quoted(name)} is longer than ${limit} characters allowed by ${ENGINE_LABELS[snapshot.engine]}`,
        hint: `Shorten it to ${limit} characters or fewer.`,
      });
    }
  };
  for (const entity of snapshot.entities) {
    check(entity.name, { entityId: entity.id }, "Entity name");
    for (const field of entity.fields) {
      check(field.name, { entityId: entity.id, fieldId: field.id }, "Field name");
    }
  }
  for (const entry of snapshot.enums) check(entry.name, { enumId: entry.id }, "Enum name");
  return issues;
}

function typeRuleIssues(snapshot: ErdSnapshot): IssueDraft[] {
  const issues: IssueDraft[] = [];
  const catalog = new Set(typeCatalogFor(snapshot.engine).map((option) => option.value));
  for (const entity of snapshot.entities) {
    for (const field of entity.fields) {
      const base = { entityId: entity.id, fieldId: field.id };
      const where = `${quoted(field.name)} in ${quoted(entity.name)}`;
      const type = normalizeType(field.type);
      if (
        snapshot.engine !== "na" &&
        type !== "" &&
        !catalog.has(type) &&
        field.enumId === undefined
      ) {
        issues.push({
          ...base,
          code: "unsupported-type",
          severity: "error",
          message: `Field ${where} uses type ${quoted(field.type)}, which ${ENGINE_LABELS[snapshot.engine]} does not support`,
          hint: "Pick a type from the list for this database.",
        });
      }
      if (needsLength(field.type)) {
        if (field.length === undefined && snapshot.engine === "mysql") {
          issues.push({
            ...base,
            code: "missing-length",
            severity: "error",
            message: `Field ${where} needs a length for ${field.type}`,
            hint: "MySQL requires a length on varchar and char columns.",
          });
        }
        if (field.length !== undefined && (!Number.isFinite(field.length) || field.length <= 0)) {
          issues.push({
            ...base,
            code: "invalid-length",
            severity: "error",
            message: `Field ${where} has an invalid length (${field.length})`,
            hint: "Use a whole number greater than zero.",
          });
        }
      }
      if (needsPrecision(field.type) && field.precision !== undefined) {
        const scale = field.scale ?? 0;
        if (field.precision <= 0 || scale < 0 || scale > field.precision) {
          issues.push({
            ...base,
            code: "invalid-precision",
            severity: "error",
            message: `Field ${where} has an invalid precision or scale (${field.precision},${scale})`,
            hint: "Scale cannot be larger than precision.",
          });
        }
      }
      if (field.primaryKey && field.nullable) {
        issues.push({
          ...base,
          code: "primary-key-nullable",
          severity: "error",
          message: `Primary key ${where} cannot be nullable`,
          hint: "Make the field required.",
        });
      }
    }
  }
  return issues;
}

const isUniqueField = (entity: ErdEntity, field: ErdField): boolean =>
  field.primaryKey ||
  field.unique ||
  entity.indexes.some(
    (index) => index.unique && index.fieldIds.length === 1 && index.fieldIds[0] === field.id,
  );

function relationshipRuleIssues(
  snapshot: ErdSnapshot,
  entityLookup: ReadonlyMap<string, ErdEntity>,
): IssueDraft[] {
  const issues: IssueDraft[] = [];
  const seen = new Map<string, ErdRelationship>();
  for (const relationship of snapshot.relationships) {
    const source = entityLookup.get(relationship.sourceEntityId);
    const target = entityLookup.get(relationship.targetEntityId);
    if (!source || !target) continue;
    const label = `${quoted(source.name)} → ${quoted(target.name)}`;
    const base = { relationshipId: relationship.id };
    const key = [
      relationship.sourceEntityId,
      relationship.sourceFieldId ?? "",
      relationship.targetEntityId,
      relationship.targetFieldId ?? "",
    ].join("|");
    if (seen.has(key)) {
      issues.push({
        ...base,
        code: "duplicate-relationship",
        severity: "warning",
        message: `Relationship ${label} is defined more than once`,
        hint: "Delete the duplicate.",
      });
    }
    seen.set(key, relationship);
    if (
      relationship.sourceEntityId === relationship.targetEntityId &&
      !relationship.targetFieldId
    ) {
      issues.push({
        ...base,
        code: "self-relationship",
        severity: "warning",
        message: `Relationship ${label} points back to the same entity without a field`,
        hint: "Pick the foreign key field, such as parent_id.",
      });
    }
    if (relationship.cardinality === "many-to-many") {
      issues.push({
        ...base,
        code: "many-to-many-without-join-table",
        severity: "warning",
        message: `Many-to-many relationship ${label} needs a join table to be created in SQL`,
        hint: "Add a join entity with a foreign key to each side.",
      });
      continue;
    }
    const sourceField = relationship.sourceFieldId
      ? source.fields.find((field) => field.id === relationship.sourceFieldId)
      : undefined;
    const targetField = relationship.targetFieldId
      ? target.fields.find((field) => field.id === relationship.targetFieldId)
      : undefined;
    if (relationship.sourceFieldId && !sourceField) {
      issues.push({
        ...base,
        code: "relationship-missing-field",
        severity: "error",
        message: `Relationship ${label} uses a field that no longer exists on ${quoted(source.name)}`,
        hint: "Reconnect it to an existing field.",
        entityId: source.id,
      });
    }
    if (relationship.targetFieldId && !targetField) {
      issues.push({
        ...base,
        code: "relationship-missing-field",
        severity: "error",
        message: `Relationship ${label} uses a field that no longer exists on ${quoted(target.name)}`,
        hint: "Reconnect it to an existing field.",
        entityId: target.id,
      });
    }
    if (sourceField && targetField) {
      if (normalizeType(sourceField.type) !== normalizeType(targetField.type)) {
        issues.push({
          ...base,
          code: "relationship-type-mismatch",
          severity: "warning",
          message: `${quoted(source.name)}.${sourceField.name} is ${sourceField.type} but ${quoted(target.name)}.${targetField.name} is ${targetField.type}`,
          hint: "A foreign key should have the same type as the key it references.",
          entityId: target.id,
          fieldId: targetField.id,
        });
      }
      if (!isUniqueField(source, sourceField)) {
        issues.push({
          ...base,
          code: "referenced-field-not-unique",
          severity: "error",
          message: `${quoted(source.name)}.${sourceField.name} is referenced by ${quoted(target.name)} but is not a primary key or unique`,
          hint: "Make the referenced field a primary key or add a unique constraint.",
          entityId: source.id,
          fieldId: sourceField.id,
        });
      }
      const indexed =
        isUniqueField(target, targetField) ||
        target.indexes.some((index) => index.fieldIds[0] === targetField.id);
      if (!indexed) {
        issues.push({
          ...base,
          code: "foreign-key-without-index",
          severity: "warning",
          message: `Foreign key ${quoted(target.name)}.${targetField.name} has no index`,
          hint: "Add an index to keep joins and deletes fast.",
          entityId: target.id,
          fieldId: targetField.id,
        });
      }
    }
  }
  return issues;
}

function orphanIssues(snapshot: ErdSnapshot): IssueDraft[] {
  if (snapshot.entities.length < 2) return [];
  const connected = new Set<string>();
  for (const relationship of snapshot.relationships) {
    connected.add(relationship.sourceEntityId);
    connected.add(relationship.targetEntityId);
  }
  return snapshot.entities
    .filter((entity) => !connected.has(entity.id) && !isBlank(entity.name))
    .map((entity) => ({
      code: "orphan-entity" as const,
      severity: "warning" as const,
      message: `Entity ${quoted(entity.name)} is not connected to any other entity`,
      hint: "Add a relationship, or ignore this if it is a standalone lookup table.",
      entityId: entity.id,
    }));
}

export function validateErd(snapshot: ErdSnapshot): ErdValidationResult {
  const entityLookup = new Map(snapshot.entities.map((entity) => [entity.id, entity]));
  const enumIds = new Set(snapshot.enums.map((entry) => entry.id));
  const drafts: IssueDraft[] = [
    ...modelIssues(snapshot),
    ...entityIssues(snapshot.entities),
    ...snapshot.entities.flatMap((entity) => [
      ...fieldIssues(entity),
      ...indexIssues(entity),
      ...fieldEnumIssues(entity, enumIds),
      ...generatedDefaultIssues(entity),
    ]),
    ...nameRuleIssues(snapshot),
    ...typeRuleIssues(snapshot),
    ...snapshot.relationships.flatMap((relationship) => [
      ...relationshipIssues(relationship, entityLookup),
      ...compositeKeyIssues(relationship),
    ]),
    ...relationshipRuleIssues(snapshot, entityLookup),
    ...circularRelationshipIssues(snapshot, entityLookup),
    ...enumIssues(snapshot.enums),
    ...unusedEnumIssues(snapshot.enums, snapshot.entities),
    ...orphanIssues(snapshot),
  ].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
  const issues = drafts.map((draft, index) => ({ ...draft, id: `${draft.code}:${index}` }));
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  return {
    valid: errorCount === 0,
    issues,
    errorCount,
    warningCount: issues.length - errorCount,
  };
}

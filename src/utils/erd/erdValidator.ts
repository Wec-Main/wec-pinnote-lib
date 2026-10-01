import type { ErdEntity, ErdEnum, ErdRelationship } from "../../types/dataModel.types";
import type { ErdSnapshot } from "./erdEngine";

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
  | "invalid-identifier";

export interface ErdValidationIssue {
  id: string;
  code: ErdIssueCode;
  severity: ErdIssueSeverity;
  message: string;
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

export function validateErd(snapshot: ErdSnapshot): ErdValidationResult {
  const entityLookup = new Map(snapshot.entities.map((entity) => [entity.id, entity]));
  const enumIds = new Set(snapshot.enums.map((entry) => entry.id));
  const drafts: IssueDraft[] = [
    ...entityIssues(snapshot.entities),
    ...snapshot.entities.flatMap((entity) => [
      ...fieldIssues(entity),
      ...indexIssues(entity),
      ...fieldEnumIssues(entity, enumIds),
    ]),
    ...snapshot.relationships.flatMap((relationship) =>
      relationshipIssues(relationship, entityLookup),
    ),
    ...enumIssues(snapshot.enums),
  ];
  const issues = drafts.map((draft, index) => ({ ...draft, id: `${draft.code}:${index}` }));
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  return {
    valid: errorCount === 0,
    issues,
    errorCount,
    warningCount: issues.length - errorCount,
  };
}

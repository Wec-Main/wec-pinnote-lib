import type {
  DataModelEngine,
  ErdDocumentJSON,
  ErdEntity,
  ErdEnum,
  ErdField,
  ErdRelationship,
} from "../../../types/dataModel.types";
import { normalizeType } from "../erdTypes";

const PROVIDER_MAP: Record<DataModelEngine, string> = {
  na: "postgresql",
  postgres: "postgresql",
  mysql: "mysql",
  sqlite: "sqlite",
};

const TYPE_MAP: Record<string, string> = {
  text: "String",
  varchar: "String",
  char: "String",
  tinytext: "String",
  mediumtext: "String",
  longtext: "String",
  uuid: "String",
  xml: "String",
  inet: "String",
  cidr: "String",
  macaddr: "String",
  tsvector: "String",
  interval: "String",
  point: "String",
  geometry: "String",
  date: "DateTime",
  time: "DateTime",
  timetz: "DateTime",
  timestamp: "DateTime",
  timestamptz: "DateTime",
  datetime: "DateTime",
  smallint: "Int",
  integer: "Int",
  serial: "Int",
  year: "Int",
  bigint: "BigInt",
  bigserial: "BigInt",
  decimal: "Decimal",
  numeric: "Decimal",
  money: "Decimal",
  real: "Float",
  double: "Float",
  float: "Float",
  boolean: "Boolean",
  json: "Json",
  jsonb: "Json",
  array: "Json",
  bytea: "Bytes",
  blob: "Bytes",
  varbinary: "Bytes",
  binary: "Bytes",
};

function toPascalCase(name: string): string {
  return name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function toCamelCase(name: string): string {
  const pascal = toPascalCase(name);
  return pascal.length === 0 ? pascal : pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function prismaType(field: ErdField, enums: ReadonlyMap<string, ErdEnum>): string {
  if (field.enumId) {
    const definition = enums.get(field.enumId);
    if (definition) return toPascalCase(definition.name);
  }
  const normalized = normalizeType(field.type);
  if (normalized === "enum") return "String";
  return TYPE_MAP[normalized] ?? "String";
}

function prismaDefault(value: string): string {
  const trimmed = value.trim().replace(/^'(.*)'$/s, "$1");
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^(current_timestamp|now\(\))$/i.test(trimmed)) return "now()";
  if (/^[A-Za-z_][A-Za-z0-9_]*\(\)$/.test(trimmed)) return trimmed;
  return JSON.stringify(trimmed);
}

function enumIdentifier(value: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value) ? value : value.replace(/[^A-Za-z0-9_]/g, "_");
}

interface RelationEdge {
  relationship: ErdRelationship;
  source: ErdEntity;
  target: ErdEntity;
  sourceColumns: ErdField[];
  targetColumns: ErdField[];
}

function resolveSourceColumns(
  entity: ErdEntity,
  fieldId: string | undefined,
  fieldIds: string[] | undefined,
): ErdField[] {
  if (fieldIds && fieldIds.length > 0) {
    const fields = fieldIds
      .map((id) => entity.fields.find((field) => field.id === id))
      .filter((field): field is ErdField => field !== undefined);
    if (fields.length === fieldIds.length) return fields;
  }
  if (fieldId) {
    const field = entity.fields.find((candidate) => candidate.id === fieldId);
    if (field) return [field];
  }
  return entity.fields.filter((field) => field.primaryKey);
}

function resolveTargetColumns(
  entity: ErdEntity,
  source: ErdEntity,
  fieldId: string | undefined,
  fieldIds: string[] | undefined,
  referencedColumns: ErdField[],
): ErdField[] | undefined {
  if (fieldIds && fieldIds.length > 0) {
    const fields = fieldIds
      .map((id) => entity.fields.find((field) => field.id === id))
      .filter((field): field is ErdField => field !== undefined);
    if (fields.length === fieldIds.length) return fields;
  }
  if (fieldId) {
    const field = entity.fields.find((candidate) => candidate.id === fieldId);
    if (field) return [field];
  }
  const derived = referencedColumns.map((column) =>
    entity.fields.find((field) => field.name === `${source.name}_${column.name}`),
  );
  return derived.every((field): field is ErdField => field !== undefined)
    ? (derived as ErdField[])
    : undefined;
}

function resolveRelationEdges(document: ErdDocumentJSON): RelationEdge[] {
  const lookup = new Map(document.entities.map((entity) => [entity.id, entity]));
  const edges: RelationEdge[] = [];
  for (const relationship of document.relationships) {
    const source = lookup.get(relationship.sourceEntityId);
    const target = lookup.get(relationship.targetEntityId);
    if (!source || !target) continue;
    const sourceColumns = resolveSourceColumns(
      source,
      relationship.sourceFieldId,
      relationship.sourceFieldIds,
    );
    if (sourceColumns.length === 0) continue;
    const targetColumns = resolveTargetColumns(
      target,
      source,
      relationship.targetFieldId,
      relationship.targetFieldIds,
      sourceColumns,
    );
    if (!targetColumns || targetColumns.length !== sourceColumns.length) continue;
    edges.push({ relationship, source, target, sourceColumns, targetColumns });
  }
  return edges;
}

interface EntityRelationLines {
  fieldAttrs: Map<string, string>;
  extraLines: string[];
}

function buildRelationLines(edges: RelationEdge[]): Map<string, EntityRelationLines> {
  const byEntity = new Map<string, EntityRelationLines>();
  const ensure = (entityId: string) => {
    let entry = byEntity.get(entityId);
    if (!entry) {
      entry = { fieldAttrs: new Map(), extraLines: [] };
      byEntity.set(entityId, entry);
    }
    return entry;
  };

  for (const edge of edges) {
    const relationName = `${toPascalCase(edge.source.name)}_${edge.relationship.id}`;
    if (edge.relationship.cardinality === "many-to-many") {
      ensure(edge.source.id).extraLines.push(
        `  ${toCamelCase(edge.target.name)} ${toPascalCase(edge.target.name)}[] @relation("${relationName}")`,
      );
      ensure(edge.target.id).extraLines.push(
        `  ${toCamelCase(edge.source.name)} ${toPascalCase(edge.source.name)}[] @relation("${relationName}")`,
      );
      continue;
    }
    const targetEntry = ensure(edge.target.id);
    const fieldsList = edge.targetColumns.map((column) => column.name).join(", ");
    const referencesList = edge.sourceColumns.map((column) => column.name).join(", ");
    const actions = `onDelete: ${prismaAction(edge.relationship.onDelete)}, onUpdate: ${prismaAction(edge.relationship.onUpdate)}`;
    const relationFieldName = toCamelCase(edge.source.name);
    const optional = edge.relationship.targetOptional ? "?" : "";
    targetEntry.extraLines.push(
      `  ${relationFieldName} ${toPascalCase(edge.source.name)}${optional} @relation(fields: [${fieldsList}], references: [${referencesList}], ${actions})`,
    );
    const sourceEntry = ensure(edge.source.id);
    const backFieldName = toCamelCase(edge.target.name);
    sourceEntry.extraLines.push(
      `  ${backFieldName} ${toPascalCase(edge.target.name)}${edge.relationship.cardinality === "one-to-one" ? "?" : "[]"}`,
    );
  }
  return byEntity;
}

function prismaAction(action: ErdRelationship["onDelete"]): string {
  const map: Record<ErdRelationship["onDelete"], string> = {
    cascade: "Cascade",
    restrict: "Restrict",
    "set-null": "SetNull",
    "no-action": "NoAction",
  };
  return map[action];
}

function fieldLine(field: ErdField, enums: ReadonlyMap<string, ErdEnum>): string {
  const type = prismaType(field, enums);
  const optional = field.nullable ? "?" : "";
  const attrs: string[] = [];
  if (field.primaryKey) attrs.push("@id");
  if (field.unique && !field.primaryKey) attrs.push("@unique");
  if (field.defaultValue !== undefined && field.defaultValue !== "") {
    const enumDefault = field.enumId
      ? enumIdentifier(field.defaultValue.trim().replace(/^'(.*)'$/s, "$1"))
      : undefined;
    attrs.push(`@default(${enumDefault ?? prismaDefault(field.defaultValue)})`);
  }
  const suffix = attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
  return `  ${field.name} ${type}${optional}${suffix}`;
}

function enumValueLine(value: string): string {
  const safe = enumIdentifier(value);
  return safe === value ? `  ${safe}` : `  ${safe} @map(${JSON.stringify(value)})`;
}

export function generatePrismaSchema(document: ErdDocumentJSON): string {
  const enums = new Map(document.enums.map((entry) => [entry.id, entry]));
  const provider = PROVIDER_MAP[document.engine] ?? "postgresql";
  const header = [
    `generator client {`,
    `  provider = "prisma-client-js"`,
    `}`,
    ``,
    `datasource db {`,
    `  provider = "${provider}"`,
    `  url      = env("DATABASE_URL")`,
    `}`,
  ].join("\n");

  const edges = resolveRelationEdges(document);
  const relationLines = buildRelationLines(edges);

  const models = document.entities.map((entity) => {
    const fieldLines = entity.fields.map((field) => fieldLine(field, enums));
    const extra = relationLines.get(entity.id)?.extraLines ?? [];
    return `model ${toPascalCase(entity.name)} {\n${[...fieldLines, ...extra].join("\n")}\n}`;
  });

  const enumBlocks = document.enums.map(
    (entry) =>
      `enum ${toPascalCase(entry.name)} {\n${entry.values.map(enumValueLine).join("\n")}\n}`,
  );

  return [header, ...models, ...enumBlocks].join("\n\n") + "\n";
}

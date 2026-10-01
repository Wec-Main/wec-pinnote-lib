import type { ErdDocumentJSON, ErdEntity, ErdEnum, ErdField } from "../../../types/dataModel.types";
import { formatFieldType, normalizeType } from "../erdTypes";
import {
  buildDdlModel,
  joinStatements,
  primaryKeyFields,
  qualifiedTableName,
  quoteIdentifier,
  quoteLiteral,
  renderDefault,
  renderForeignKeys,
  renderIndexes,
} from "./ddlCommon";

const TYPE_MAP: Record<string, string> = {
  double: "double precision",
  float: "double precision",
  datetime: "timestamp",
  year: "smallint",
  tinytext: "text",
  mediumtext: "text",
  longtext: "text",
  blob: "bytea",
  varbinary: "bytea",
  binary: "bytea",
  array: "text[]",
};

const quote = (name: string) => quoteIdentifier(name, "postgres");
const literal = (value: string) => quoteLiteral(value, "postgres");

function columnType(field: ErdField, enums: ReadonlyMap<string, ErdEnum>): string {
  const enumDefinition = field.enumId ? enums.get(field.enumId) : undefined;
  if (enumDefinition) return quote(enumDefinition.name);
  const normalized = normalizeType(field.type);
  if (normalized === "enum") return "text";
  if (TYPE_MAP[normalized] === "bytea") return "bytea";
  return formatFieldType(field, TYPE_MAP[normalized] ?? field.type);
}

function columnDefinition(field: ErdField, enums: ReadonlyMap<string, ErdEnum>): string {
  const parts = [quote(field.name), columnType(field, enums)];
  if (!field.nullable || field.primaryKey) parts.push("NOT NULL");
  if (field.defaultValue !== undefined && field.defaultValue !== "") {
    parts.push(`DEFAULT ${renderDefault(field.defaultValue, "postgres")}`);
  }
  if (field.unique && !field.primaryKey) parts.push("UNIQUE");
  return parts.join(" ");
}

function createTable(table: ErdEntity, enums: ReadonlyMap<string, ErdEnum>): string {
  const lines = table.fields.map((field) => columnDefinition(field, enums));
  const keys = primaryKeyFields(table);
  if (keys.length > 0) {
    lines.push(`PRIMARY KEY (${keys.map((field) => quote(field.name)).join(", ")})`);
  }
  const body = lines.map((line) => `  ${line}`).join(",\n");
  return `CREATE TABLE ${qualifiedTableName(table, "postgres")} (\n${body}\n);`;
}

function comments(table: ErdEntity): string[] {
  if (!table.comment) return [];
  return [
    `COMMENT ON TABLE ${qualifiedTableName(table, "postgres")} IS ${literal(table.comment)};`,
  ];
}

export function renderPostgresDdl(document: ErdDocumentJSON): string {
  const model = buildDdlModel(document);
  const enums = new Map(document.enums.map((entry) => [entry.id, entry]));
  const types = document.enums.map(
    (entry) =>
      `CREATE TYPE ${quote(entry.name)} AS ENUM (${entry.values.map(literal).join(", ")});`,
  );
  return joinStatements([
    ...types,
    ...model.tables.map((table) => createTable(table, enums)),
    ...renderIndexes(model, "postgres"),
    ...renderForeignKeys(model, "postgres"),
    ...model.tables.flatMap(comments),
  ]);
}

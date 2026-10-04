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
  skippedComments,
} from "./ddlCommon";

const DEFAULT_VARCHAR_LENGTH = 255;

const TYPE_MAP: Record<string, string> = {
  uuid: "CHAR(36)",
  boolean: "TINYINT(1)",
  json: "JSON",
  jsonb: "JSON",
  bytea: "BLOB",
  timestamptz: "TIMESTAMP",
  timetz: "TIME",
  double: "DOUBLE",
  float: "FLOAT",
  real: "FLOAT",
  integer: "INT",
  serial: "INT",
  bigserial: "BIGINT",
  numeric: "DECIMAL",
  money: "DECIMAL(19,4)",
  interval: "VARCHAR(64)",
  inet: "VARCHAR(45)",
  cidr: "VARCHAR(43)",
  macaddr: "VARCHAR(17)",
  tsvector: "TEXT",
  xml: "TEXT",
  array: "JSON",
  point: "POINT",
  geometry: "GEOMETRY",
};

const quote = (name: string) => quoteIdentifier(name, "mysql");
const literal = (value: string) => quoteLiteral(value, "mysql");

function columnType(field: ErdField, enums: ReadonlyMap<string, ErdEnum>): string {
  const normalized = normalizeType(field.type);
  const definition = field.enumId ? enums.get(field.enumId) : undefined;
  if (definition) return `ENUM(${definition.values.map(literal).join(", ")})`;
  if (normalized === "enum") return "TEXT";
  if (normalized === "varchar" && field.length === undefined) {
    return `VARCHAR(${DEFAULT_VARCHAR_LENGTH})`;
  }
  if (normalized === "varbinary" && field.length === undefined) {
    return `VARBINARY(${DEFAULT_VARCHAR_LENGTH})`;
  }
  return formatFieldType(field, TYPE_MAP[normalized] ?? field.type);
}

function columnDefinition(field: ErdField, enums: ReadonlyMap<string, ErdEnum>): string {
  const parts = [quote(field.name), columnType(field, enums)];
  if (!field.nullable || field.primaryKey) parts.push("NOT NULL");
  if (field.generated) {
    const mode = field.generated.stored === false ? "VIRTUAL" : "STORED";
    parts.push(`GENERATED ALWAYS AS (${field.generated.expression}) ${mode}`);
  } else if (field.defaultValue !== undefined && field.defaultValue !== "") {
    parts.push(`DEFAULT ${renderDefault(field.defaultValue, "mysql")}`);
  }
  if (field.unique && !field.primaryKey) parts.push("UNIQUE");
  if (field.check) parts.push(`CHECK (${field.check})`);
  if (field.comment) parts.push(`COMMENT ${literal(field.comment)}`);
  return parts.join(" ");
}

function createTable(table: ErdEntity, enums: ReadonlyMap<string, ErdEnum>): string {
  const lines = table.fields.map((field) => columnDefinition(field, enums));
  const keys = primaryKeyFields(table);
  if (keys.length > 0) {
    lines.push(`PRIMARY KEY (${keys.map((field) => quote(field.name)).join(", ")})`);
  }
  const body = lines.map((line) => `  ${line}`).join(",\n");
  const options = table.comment ? ` COMMENT=${literal(table.comment)}` : "";
  return `CREATE TABLE ${qualifiedTableName(table, "mysql")} (\n${body}\n)${options};`;
}

export function renderMysqlDdl(document: ErdDocumentJSON): string {
  const model = buildDdlModel(document);
  const enums = new Map(document.enums.map((entry) => [entry.id, entry]));
  return joinStatements([
    ...skippedComments(model),
    ...model.tables.map((table) => createTable(table, enums)),
    ...renderIndexes(model, "mysql"),
    ...renderForeignKeys(model, "mysql"),
  ]);
}

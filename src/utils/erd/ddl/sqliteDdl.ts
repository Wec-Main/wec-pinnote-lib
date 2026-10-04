import type { ErdDocumentJSON, ErdEntity, ErdEnum, ErdField } from "../../../types/dataModel.types";
import { formatFieldType, normalizeType } from "../erdTypes";
import {
  buildDdlModel,
  joinStatements,
  primaryKeyFields,
  qualifiedTableName,
  quoteIdentifier,
  quoteLiteral,
  referentialAction,
  renderDefault,
  renderIndexes,
  skippedComments,
  type DdlModel,
} from "./ddlCommon";

const TYPE_MAP: Record<string, string> = {
  smallint: "INTEGER",
  integer: "INTEGER",
  bigint: "INTEGER",
  serial: "INTEGER",
  bigserial: "INTEGER",
  year: "INTEGER",
  boolean: "INTEGER",
  decimal: "NUMERIC",
  numeric: "NUMERIC",
  money: "NUMERIC",
  real: "REAL",
  double: "REAL",
  float: "REAL",
  char: "TEXT",
  varchar: "TEXT",
  text: "TEXT",
  tinytext: "TEXT",
  mediumtext: "TEXT",
  longtext: "TEXT",
  date: "TEXT",
  time: "TEXT",
  timetz: "TEXT",
  timestamp: "TEXT",
  timestamptz: "TEXT",
  datetime: "TEXT",
  interval: "TEXT",
  bytea: "BLOB",
  blob: "BLOB",
  varbinary: "BLOB",
  binary: "BLOB",
  json: "TEXT",
  jsonb: "TEXT",
  xml: "TEXT",
  uuid: "TEXT",
  inet: "TEXT",
  cidr: "TEXT",
  macaddr: "TEXT",
  point: "TEXT",
  geometry: "TEXT",
  tsvector: "TEXT",
  array: "TEXT",
};

const quote = (name: string) => quoteIdentifier(name, "sqlite");
const literal = (value: string) => quoteLiteral(value, "sqlite");

function columnType(field: ErdField): string {
  const normalized = normalizeType(field.type);
  if (normalized === "enum") return "TEXT";
  return formatFieldType(field, TYPE_MAP[normalized] ?? "TEXT");
}

function columnDefinition(field: ErdField, enums: ReadonlyMap<string, ErdEnum>): string {
  const parts = [quote(field.name), columnType(field)];
  if (!field.nullable || field.primaryKey) parts.push("NOT NULL");
  if (field.generated) {
    parts.push(`GENERATED ALWAYS AS (${field.generated.expression}) STORED`);
  } else if (field.defaultValue !== undefined && field.defaultValue !== "") {
    parts.push(`DEFAULT ${renderDefault(field.defaultValue, "sqlite")}`);
  }
  if (field.unique && !field.primaryKey) parts.push("UNIQUE");
  if (field.check) parts.push(`CHECK (${field.check})`);
  const enumDefinition = field.enumId ? enums.get(field.enumId) : undefined;
  if (enumDefinition) {
    parts.push(
      `CHECK (${quote(field.name)} IN (${enumDefinition.values.map(literal).join(", ")}))`,
    );
  }
  return parts.join(" ");
}

function createTable(
  table: ErdEntity,
  enums: ReadonlyMap<string, ErdEnum>,
  model: DdlModel,
): string {
  const lines = table.fields.map((field) => columnDefinition(field, enums));
  const keys = primaryKeyFields(table);
  if (keys.length > 0) {
    lines.push(`PRIMARY KEY (${keys.map((field) => quote(field.name)).join(", ")})`);
  }
  const list = (columns: readonly ErdField[]) =>
    columns.map((column) => quote(column.name)).join(", ");
  for (const key of model.foreignKeys) {
    if (key.table.id !== table.id) continue;
    if (key.uniqueConstraint) {
      lines.push(`UNIQUE (${list(key.columns)})`);
    }
    const reference = `${qualifiedTableName(key.referencedTable, "sqlite")} (${list(key.referencedColumns)})`;
    lines.push(
      `FOREIGN KEY (${list(key.columns)}) REFERENCES ${reference} ON DELETE ${referentialAction(key.onDelete)} ON UPDATE ${referentialAction(key.onUpdate)}`,
    );
  }
  const body = lines.map((line) => `  ${line}`).join(",\n");
  return `CREATE TABLE ${qualifiedTableName(table, "sqlite")} (\n${body}\n);`;
}

export function renderSqliteDdl(document: ErdDocumentJSON): string {
  const model = buildDdlModel(document);
  const enums = new Map(document.enums.map((entry) => [entry.id, entry]));
  return joinStatements([
    ...skippedComments(model),
    ...model.tables.map((table) => createTable(table, enums, model)),
    ...renderIndexes(model, "sqlite"),
  ]);
}

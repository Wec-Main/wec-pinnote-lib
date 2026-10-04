import type {
  DataModelEngine,
  ErdDocumentJSON,
  ErdEntity,
  ErdField,
} from "../../../types/dataModel.types";
import { normalizeType } from "../erdTypes";

type Core = "pg" | "mysql" | "sqlite";

const IMPORT_SOURCE: Record<Core, string> = {
  pg: "drizzle-orm/pg-core",
  mysql: "drizzle-orm/mysql-core",
  sqlite: "drizzle-orm/sqlite-core",
};

const TABLE_FN: Record<Core, string> = {
  pg: "pgTable",
  mysql: "mysqlTable",
  sqlite: "sqliteTable",
};

function coreFor(engine: DataModelEngine): Core {
  if (engine === "mysql") return "mysql";
  if (engine === "sqlite") return "sqlite";
  return "pg";
}

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

const PG_TEXT = new Set([
  "text",
  "char",
  "tinytext",
  "mediumtext",
  "longtext",
  "uuid",
  "xml",
  "inet",
  "cidr",
  "macaddr",
  "tsvector",
  "interval",
  "point",
  "geometry",
  "bytea",
  "blob",
  "varbinary",
  "binary",
]);
const PG_TIMESTAMP = new Set(["date", "time", "timetz", "timestamp", "timestamptz", "datetime"]);
const PG_INTEGER = new Set(["smallint", "integer", "serial", "year"]);
const PG_BIGINT = new Set(["bigint", "bigserial"]);
const PG_NUMERIC = new Set(["decimal", "numeric", "money"]);
const PG_FLOAT = new Set(["real", "double", "float"]);
const PG_JSON = new Set(["json", "jsonb", "array"]);

function pgBuilder(field: ErdField): { fn: string; args: string } {
  const normalized = normalizeType(field.type);
  const name = JSON.stringify(field.name);
  if (normalized === "varchar") {
    const length = field.length ?? 255;
    return { fn: "varchar", args: `${name}, { length: ${length} }` };
  }
  if (PG_INTEGER.has(normalized)) return { fn: "integer", args: name };
  if (PG_BIGINT.has(normalized)) return { fn: "bigint", args: `${name}, { mode: "number" }` };
  if (PG_NUMERIC.has(normalized)) return { fn: "numeric", args: name };
  if (PG_FLOAT.has(normalized)) return { fn: "doublePrecision", args: name };
  if (normalized === "boolean") return { fn: "boolean", args: name };
  if (PG_TIMESTAMP.has(normalized)) return { fn: "timestamp", args: name };
  if (PG_JSON.has(normalized)) return { fn: "jsonb", args: name };
  if (PG_TEXT.has(normalized)) return { fn: "text", args: name };
  return { fn: "text", args: name };
}

const MYSQL_INT = new Set(["smallint", "integer", "serial", "year"]);
const MYSQL_DECIMAL = new Set(["decimal", "numeric", "money", "real", "double", "float"]);
const MYSQL_DATE = new Set(["date", "time", "timetz", "timestamp", "timestamptz", "datetime"]);
const MYSQL_JSON = new Set(["json", "jsonb", "array"]);

function mysqlBuilder(field: ErdField): { fn: string; args: string } {
  const normalized = normalizeType(field.type);
  const name = JSON.stringify(field.name);
  if (normalized === "varchar" || normalized === "char") {
    const length = field.length ?? 255;
    return { fn: "varchar", args: `${name}, { length: ${length} }` };
  }
  if (MYSQL_INT.has(normalized)) return { fn: "int", args: name };
  if (normalized === "bigint" || normalized === "bigserial")
    return { fn: "bigint", args: `${name}, { mode: "number" }` };
  if (MYSQL_DECIMAL.has(normalized)) return { fn: "decimal", args: name };
  if (normalized === "boolean") return { fn: "boolean", args: name };
  if (MYSQL_DATE.has(normalized)) return { fn: "datetime", args: name };
  if (MYSQL_JSON.has(normalized)) return { fn: "json", args: name };
  return { fn: "text", args: name };
}

const SQLITE_INT = new Set(["smallint", "integer", "bigint", "serial", "bigserial", "year"]);
const SQLITE_REAL = new Set(["decimal", "numeric", "money", "real", "double", "float"]);

function sqliteBuilder(field: ErdField): { fn: string; args: string } {
  const normalized = normalizeType(field.type);
  const name = JSON.stringify(field.name);
  if (normalized === "boolean") return { fn: "integer", args: `${name}, { mode: "boolean" }` };
  if (SQLITE_INT.has(normalized)) return { fn: "integer", args: name };
  if (SQLITE_REAL.has(normalized)) return { fn: "real", args: name };
  if (
    normalized === "bytea" ||
    normalized === "blob" ||
    normalized === "varbinary" ||
    normalized === "binary"
  ) {
    return { fn: "blob", args: name };
  }
  return { fn: "text", args: name };
}

function builderFor(core: Core, field: ErdField): { fn: string; args: string } {
  if (core === "mysql") return mysqlBuilder(field);
  if (core === "sqlite") return sqliteBuilder(field);
  return pgBuilder(field);
}

function literalDefault(value: string): { expr: string; needsSql: boolean } {
  const trimmed = value.trim().replace(/^'(.*)'$/s, "$1");
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return { expr: trimmed, needsSql: false };
  if (/^(true|false)$/i.test(trimmed)) return { expr: trimmed.toLowerCase(), needsSql: false };
  if (/^current_timestamp$/i.test(trimmed)) return { expr: "sql`now()`", needsSql: true };
  if (/^[A-Za-z_][A-Za-z0-9_]*\(.*\)$/.test(trimmed))
    return { expr: `sql\`${trimmed}\``, needsSql: true };
  return { expr: JSON.stringify(trimmed), needsSql: false };
}

interface ForeignKeyRef {
  targetTable: string;
  targetColumn: string;
}

function resolveSingleColumnFk(
  document: ErdDocumentJSON,
  entity: ErdEntity,
  field: ErdField,
): ForeignKeyRef | undefined {
  for (const relationship of document.relationships) {
    if (relationship.targetEntityId !== entity.id) continue;
    if (relationship.cardinality === "many-to-many") continue;
    if (relationship.sourceFieldIds || relationship.targetFieldIds) continue;
    if (relationship.targetFieldId !== field.id) continue;
    const source = document.entities.find(
      (candidate) => candidate.id === relationship.sourceEntityId,
    );
    if (!source) continue;
    const sourceField = relationship.sourceFieldId
      ? source.fields.find((candidate) => candidate.id === relationship.sourceFieldId)
      : source.fields.find((candidate) => candidate.primaryKey);
    if (!sourceField) continue;
    return { targetTable: toCamelCase(source.name), targetColumn: sourceField.name };
  }
  return undefined;
}

function columnLine(
  document: ErdDocumentJSON,
  core: Core,
  entity: ErdEntity,
  field: ErdField,
  needsSql: { value: boolean },
): string {
  const { fn, args } = builderFor(core, field);
  let expr = `${fn}(${args})`;
  if (field.primaryKey) expr += ".primaryKey()";
  if (!field.nullable && !field.primaryKey) expr += ".notNull()";
  if (field.unique && !field.primaryKey) expr += ".unique()";
  if (field.defaultValue !== undefined && field.defaultValue !== "") {
    const { expr: defaultExpr, needsSql: usesSql } = literalDefault(field.defaultValue);
    if (usesSql) needsSql.value = true;
    expr += `.default(${defaultExpr})`;
  }
  const fk = resolveSingleColumnFk(document, entity, field);
  if (fk) expr += `.references(() => ${fk.targetTable}.${fk.targetColumn})`;
  return `  ${field.name}: ${expr},`;
}

export function generateDrizzleSchema(document: ErdDocumentJSON): string {
  const core = coreFor(document.engine);
  const tableFn = TABLE_FN[core];
  const needsSql = { value: false };
  const builders = new Set<string>();

  const tables = document.entities.map((entity) => {
    const lines = entity.fields.map((field) => {
      const line = columnLine(document, core, entity, field, needsSql);
      builders.add(builderFor(core, field).fn);
      return line;
    });
    return `export const ${toCamelCase(entity.name)} = ${tableFn}(${JSON.stringify(entity.name)}, {\n${lines.join("\n")}\n});`;
  });

  const importNames = [...builders].sort();
  const imports = [
    `import { ${tableFn}, ${importNames.join(", ")} } from "${IMPORT_SOURCE[core]}";`,
    ...(needsSql.value ? [`import { sql } from "drizzle-orm";`] : []),
  ].join("\n");

  if (tables.length === 0) return "";
  return `${imports}\n\n${tables.join("\n\n")}\n`;
}

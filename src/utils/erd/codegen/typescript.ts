import type { ErdDocumentJSON, ErdEntity, ErdEnum, ErdField } from "../../../types/dataModel.types";
import { normalizeType } from "../erdTypes";

type JsKind = "string" | "number" | "boolean" | "unknown";

const TYPE_MAP: Record<string, JsKind> = {
  text: "string",
  varchar: "string",
  char: "string",
  tinytext: "string",
  mediumtext: "string",
  longtext: "string",
  uuid: "string",
  date: "string",
  time: "string",
  timetz: "string",
  timestamp: "string",
  timestamptz: "string",
  datetime: "string",
  interval: "string",
  inet: "string",
  cidr: "string",
  macaddr: "string",
  xml: "string",
  tsvector: "string",
  smallint: "number",
  integer: "number",
  bigint: "number",
  serial: "number",
  bigserial: "number",
  decimal: "number",
  numeric: "number",
  real: "number",
  double: "number",
  float: "number",
  money: "number",
  year: "number",
  boolean: "boolean",
  json: "unknown",
  jsonb: "unknown",
  array: "unknown",
  point: "unknown",
  geometry: "unknown",
  bytea: "unknown",
  blob: "unknown",
  varbinary: "unknown",
  binary: "unknown",
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

function jsKind(field: ErdField): JsKind {
  const normalized = normalizeType(field.type);
  if (normalized === "enum") return "string";
  return TYPE_MAP[normalized] ?? "string";
}

function tsType(field: ErdField, enums: ReadonlyMap<string, ErdEnum>): string {
  if (field.enumId) {
    const definition = enums.get(field.enumId);
    if (definition) return toPascalCase(definition.name);
  }
  return jsKind(field);
}

function interfaceFor(entity: ErdEntity, enums: ReadonlyMap<string, ErdEnum>): string {
  const lines = entity.fields.map((field) => {
    const optional = field.nullable ? "?" : "";
    const nullable = field.nullable ? " | null" : "";
    return `  ${field.name}${optional}: ${tsType(field, enums)}${nullable};`;
  });
  return `export interface ${toPascalCase(entity.name)} {\n${lines.join("\n")}\n}`;
}

function zodExprFor(field: ErdField, enums: ReadonlyMap<string, ErdEnum>): string {
  let expr: string;
  const definition = field.enumId ? enums.get(field.enumId) : undefined;
  if (definition) {
    expr = `z.enum([${definition.values.map((value) => JSON.stringify(value)).join(", ")}])`;
  } else {
    const kind = jsKind(field);
    expr =
      kind === "number"
        ? "z.number()"
        : kind === "boolean"
          ? "z.boolean()"
          : kind === "unknown"
            ? "z.unknown()"
            : "z.string()";
  }
  if (field.nullable) expr += ".nullable()";
  if (field.defaultValue !== undefined && field.defaultValue !== "") expr += ".optional()";
  return expr;
}

function zodSchemaFor(entity: ErdEntity, enums: ReadonlyMap<string, ErdEnum>): string {
  const lines = entity.fields.map((field) => `  ${field.name}: ${zodExprFor(field, enums)},`);
  return `export const ${toCamelCase(entity.name)}Schema = z.object({\n${lines.join("\n")}\n});`;
}

export function generateTypeScript(document: ErdDocumentJSON): string {
  const enums = new Map(document.enums.map((entry) => [entry.id, entry]));
  const enumBlocks = document.enums.map(
    (entry) =>
      `export type ${toPascalCase(entry.name)} = ${entry.values
        .map((value) => JSON.stringify(value))
        .join(" | ")};`,
  );
  const entityBlocks = document.entities.flatMap((entity) => [
    interfaceFor(entity, enums),
    zodSchemaFor(entity, enums),
  ]);
  const blocks = [...enumBlocks, ...entityBlocks];
  if (blocks.length === 0) return "";
  const header = document.entities.length > 0 ? `import { z } from "zod";\n\n` : "";
  return `${header}${blocks.join("\n\n")}\n`;
}

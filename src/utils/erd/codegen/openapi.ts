import type { ErdDocumentJSON, ErdEntity, ErdEnum, ErdField } from "../../../types/dataModel.types";
import { normalizeType } from "../erdTypes";

interface JsonSchema {
  type: string | string[];
  format?: string;
  enum?: string[];
  items?: JsonSchema;
}

function toPascalCase(name: string): string {
  return name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

const INTEGER_TYPES = new Set(["smallint", "integer", "serial", "bigint", "bigserial", "year"]);
const NUMBER_TYPES = new Set(["decimal", "numeric", "real", "double", "float", "money"]);

function baseSchemaFor(field: ErdField, enums: ReadonlyMap<string, ErdEnum>): JsonSchema {
  const definition = field.enumId ? enums.get(field.enumId) : undefined;
  if (definition) return { type: "string", enum: definition.values };
  const normalized = normalizeType(field.type);
  if (normalized === "enum") return { type: "string" };
  if (normalized === "uuid") return { type: "string", format: "uuid" };
  if (normalized === "timestamp" || normalized === "timestamptz" || normalized === "datetime") {
    return { type: "string", format: "date-time" };
  }
  if (normalized === "date") return { type: "string", format: "date" };
  if (normalized === "time" || normalized === "timetz") return { type: "string", format: "time" };
  if (INTEGER_TYPES.has(normalized)) return { type: "integer" };
  if (NUMBER_TYPES.has(normalized)) return { type: "number" };
  if (normalized === "boolean") return { type: "boolean" };
  if (normalized === "json" || normalized === "jsonb") return { type: "object" };
  if (normalized === "array") return { type: "array", items: { type: "string" } };
  return { type: "string" };
}

function applyNullable(schema: JsonSchema, nullable: boolean): JsonSchema {
  if (!nullable || Array.isArray(schema.type)) return schema;
  return { ...schema, type: [schema.type, "null"] };
}

function schemaForEntity(entity: ErdEntity, enums: ReadonlyMap<string, ErdEnum>) {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  for (const field of entity.fields) {
    properties[field.name] = applyNullable(baseSchemaFor(field, enums), field.nullable);
    if (!field.nullable) required.push(field.name);
  }
  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

export function generateOpenApiSchemas(document: ErdDocumentJSON): string {
  const enums = new Map(document.enums.map((entry) => [entry.id, entry]));
  const schemas: Record<string, ReturnType<typeof schemaForEntity>> = {};
  for (const entity of document.entities) {
    schemas[toPascalCase(entity.name)] = schemaForEntity(entity, enums);
  }
  return JSON.stringify({ components: { schemas } }, null, 2);
}

import type { OpErrorCode } from "./types";

export type Shape =
  | { type: "string"; minLength?: number; pattern?: string; description?: string }
  | { type: "integer"; minimum?: number; description?: string }
  | { type: "number"; minimum?: number; description?: string }
  | { type: "boolean"; description?: string }
  | { type: "enum"; values: readonly string[]; description?: string }
  | { type: "array"; items: Shape; minItems?: number; description?: string }
  | {
      type: "object";
      properties: Readonly<Record<string, Shape>>;
      required?: readonly string[];
      description?: string;
    }
  | { type: "map"; values: Shape; description?: string }
  | { type: "scalar"; description?: string }
  | { type: "nullable"; inner: Shape; description?: string };

export interface ShapeIssue {
  code: Extract<OpErrorCode, "invalid_shape" | "invalid_value">;
  message: string;
}

type JsonSchema = Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const UNSAFE_KEYS: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  return typeof value;
}

export function checkShape(
  value: unknown,
  shape: Shape,
  path: string,
  issues: ShapeIssue[],
): unknown {
  const shapeIssue = (expected: string) => {
    issues.push({
      code: "invalid_shape",
      message: `${path} must be ${expected}, got ${describe(value)}`,
    });
    return undefined;
  };
  switch (shape.type) {
    case "string": {
      if (typeof value !== "string") return shapeIssue("a string");
      if (shape.minLength !== undefined && value.trim().length < shape.minLength) {
        issues.push({ code: "invalid_value", message: `${path} must not be empty` });
        return undefined;
      }
      if (shape.pattern !== undefined && !new RegExp(shape.pattern).test(value)) {
        issues.push({
          code: "invalid_value",
          message: `${path} does not match the required format`,
        });
        return undefined;
      }
      return value;
    }
    case "integer":
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) return shapeIssue("a number");
      if (shape.type === "integer" && !Number.isInteger(value)) return shapeIssue("an integer");
      if (shape.minimum !== undefined && value < shape.minimum) {
        issues.push({ code: "invalid_value", message: `${path} must be >= ${shape.minimum}` });
        return undefined;
      }
      return value;
    }
    case "boolean":
      return typeof value === "boolean" ? value : shapeIssue("a boolean");
    case "enum": {
      if (typeof value === "string" && shape.values.includes(value)) return value;
      issues.push({
        code: "invalid_value",
        message: `${path} must be one of ${shape.values.map((v) => `"${v}"`).join(", ")}`,
      });
      return undefined;
    }
    case "scalar": {
      const ok =
        value === null ||
        typeof value === "string" ||
        typeof value === "boolean" ||
        (typeof value === "number" && Number.isFinite(value));
      return ok ? value : shapeIssue("a string, number, boolean or null");
    }
    case "nullable":
      return value === null ? null : checkShape(value, shape.inner, path, issues);
    case "array": {
      if (!Array.isArray(value)) return shapeIssue("an array");
      if (shape.minItems !== undefined && value.length < shape.minItems) {
        issues.push({
          code: "invalid_value",
          message: `${path} must have at least ${shape.minItems} item(s)`,
        });
      }
      return value.map((item, i) => checkShape(item, shape.items, `${path}[${i}]`, issues));
    }
    case "map": {
      if (!isRecord(value)) return shapeIssue("an object");
      const out: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(value)) {
        if (UNSAFE_KEYS.has(key)) {
          issues.push({ code: "invalid_value", message: `${path} must not use the key "${key}"` });
          continue;
        }
        out[key] = checkShape(entry, shape.values, `${path}.${key}`, issues);
      }
      return out;
    }
    case "object": {
      if (!isRecord(value)) return shapeIssue("an object");
      const out: Record<string, unknown> = {};
      for (const key of shape.required ?? []) {
        if (value[key] === undefined) {
          issues.push({ code: "invalid_shape", message: `${path}.${key} is required` });
        }
      }
      for (const [key, entry] of Object.entries(value)) {
        const inner = shape.properties[key];
        if (!inner) {
          const known = Object.keys(shape.properties).join(", ");
          issues.push({
            code: "invalid_shape",
            message: `${path}.${key} is not allowed (allowed: ${known})`,
          });
          continue;
        }
        if (entry === undefined) continue;
        out[key] = checkShape(entry, inner, `${path}.${key}`, issues);
      }
      return out;
    }
  }
}

function withDescription(schema: JsonSchema, description: string | undefined): JsonSchema {
  return description ? { ...schema, description } : schema;
}

export function toJsonSchema(shape: Shape): JsonSchema {
  switch (shape.type) {
    case "string":
      return withDescription(
        {
          type: "string",
          ...(shape.minLength !== undefined ? { minLength: shape.minLength } : {}),
          ...(shape.pattern !== undefined ? { pattern: shape.pattern } : {}),
        },
        shape.description,
      );
    case "integer":
    case "number":
      return withDescription(
        {
          type: shape.type,
          ...(shape.minimum !== undefined ? { minimum: shape.minimum } : {}),
        },
        shape.description,
      );
    case "boolean":
      return withDescription({ type: "boolean" }, shape.description);
    case "enum":
      return withDescription({ type: "string", enum: [...shape.values] }, shape.description);
    case "scalar":
      return withDescription({ type: ["string", "number", "boolean", "null"] }, shape.description);
    case "nullable":
      return withDescription(
        { anyOf: [toJsonSchema(shape.inner), { type: "null" }] },
        shape.description,
      );
    case "array":
      return withDescription(
        {
          type: "array",
          items: toJsonSchema(shape.items),
          ...(shape.minItems !== undefined ? { minItems: shape.minItems } : {}),
        },
        shape.description,
      );
    case "map":
      return withDescription(
        { type: "object", additionalProperties: toJsonSchema(shape.values) },
        shape.description,
      );
    case "object":
      return withDescription(
        {
          type: "object",
          properties: Object.fromEntries(
            Object.entries(shape.properties).map(([key, inner]) => [key, toJsonSchema(inner)]),
          ),
          ...(shape.required && shape.required.length > 0 ? { required: [...shape.required] } : {}),
          additionalProperties: false,
        },
        shape.description,
      );
  }
}

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ERD_OP_SPECS,
  ERD_OPS_JSON_SCHEMA,
  FLOW_OP_SPECS,
  FLOW_OPS_JSON_SCHEMA,
} from "../src/ai/ops";

const OPS_DIR = resolve(__dirname, "../src/ai/ops");

function opNamesInTypes(typeName: "ErdOp" | "FlowOp"): string[] {
  const source = readFileSync(resolve(OPS_DIR, "types.ts"), "utf8");
  const start = source.indexOf(`export type ${typeName} =`);
  const end = source.indexOf(`export type ${typeName}Name`, start);
  const block = source.slice(start, end);
  return [...block.matchAll(/op: "([A-Za-z]+)"/g)].map((match) => match[1] as string);
}

type Variant = {
  title: string;
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: boolean;
};

function variants(schema: Record<string, unknown>): Variant[] {
  return ((schema.items as { oneOf: Variant[] }).oneOf ?? []) as Variant[];
}

describe("op JSON schemas", () => {
  for (const [typeName, schema, specs] of [
    ["ErdOp", ERD_OPS_JSON_SCHEMA, ERD_OP_SPECS],
    ["FlowOp", FLOW_OPS_JSON_SCHEMA, FLOW_OP_SPECS],
  ] as const) {
    it(`${typeName}: every op in the types has a schema variant and vice versa`, () => {
      const names = opNamesInTypes(typeName);
      expect(names.length).toBeGreaterThan(5);
      expect(
        variants(schema)
          .map((v) => v.title)
          .sort(),
      ).toEqual([...names].sort());
      expect(Object.keys(specs).sort()).toEqual([...names].sort());
    });

    it(`${typeName}: is draft 2020-12, closed, and requires op`, () => {
      expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
      expect(schema.type).toBe("array");
      for (const variant of variants(schema)) {
        expect(variant.properties.op).toEqual({ const: variant.title });
        expect(variant.required[0]).toBe("op");
        expect(variant.additionalProperties).toBe(false);
        for (const key of variant.required) expect(variant.properties).toHaveProperty(key);
      }
      expect(() => JSON.stringify(schema)).not.toThrow();
    });
  }

  it("marks nullable patch values and enums correctly", () => {
    const updateField = variants(ERD_OPS_JSON_SCHEMA).find((v) => v.title === "updateField")!;
    const patch = updateField.properties.patch as { properties: Record<string, unknown> };
    expect(patch.properties.enum).toMatchObject({ anyOf: [{ type: "string" }, { type: "null" }] });
    const setEngine = variants(ERD_OPS_JSON_SCHEMA).find((v) => v.title === "setEngine")!;
    expect(setEngine.properties.engine).toMatchObject({
      enum: ["na", "postgres", "mysql", "sqlite"],
    });
  });
});

describe("src/ai/ops import graph", () => {
  const FORBIDDEN_MODULES = /^(react|react-dom)(\/|$)/;
  const BROWSER_GLOBALS = [
    /\bwindow\b/,
    /\bdocument\.(body|head|documentElement|createElement|createTextNode|querySelector|querySelectorAll|getElementById|addEventListener|removeEventListener|visibilityState|cookie|location)\b/,
    /\bglobalThis\.document\b/,
    /\b(localStorage|sessionStorage|navigator|EventSource)\b/,
  ];

  function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  }

  function runtimeImports(source: string): string[] {
    const out: string[] = [];
    const pattern = /(?:^|\n)\s*(import|export)\s+(type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']/g;
    for (const match of source.matchAll(pattern)) {
      const typeOnly = Boolean(match[2]);
      const clause = match[3] ?? "";
      const named = clause.match(/\{([\s\S]*)\}/);
      const allTypes =
        named !== null &&
        !clause
          .replace(/\{[\s\S]*\}/, "")
          .replace(/,/g, "")
          .trim() &&
        named[1]!
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
          .every((part) => part.startsWith("type "));
      if (!typeOnly && !allTypes) out.push(match[4] as string);
    }
    for (const match of source.matchAll(/(?:^|\n)\s*import\s+["']([^"']+)["']/g)) {
      out.push(match[1] as string);
    }
    return out;
  }

  function resolveModule(from: string, specifier: string): string | null {
    if (!specifier.startsWith(".")) return null;
    const base = resolve(dirname(from), specifier);
    for (const candidate of [`${base}.ts`, `${base}.tsx`, resolve(base, "index.ts")]) {
      if (existsSync(candidate)) return candidate;
    }
    throw new Error(`Cannot resolve ${specifier} from ${from}`);
  }

  it("has no React / DOM runtime dependency", () => {
    const seen = new Set<string>();
    const queue = [resolve(OPS_DIR, "index.ts")];
    const problems: string[] = [];
    while (queue.length > 0) {
      const file = queue.pop() as string;
      if (seen.has(file)) continue;
      seen.add(file);
      const source = stripComments(readFileSync(file, "utf8"));
      for (const specifier of runtimeImports(source)) {
        if (FORBIDDEN_MODULES.test(specifier)) problems.push(`${file} imports ${specifier}`);
        const next = resolveModule(file, specifier);
        if (next) queue.push(next);
        else if (!specifier.startsWith("node:") && !FORBIDDEN_MODULES.test(specifier)) {
          problems.push(`${file} imports package ${specifier}`);
        }
      }
      for (const pattern of BROWSER_GLOBALS) {
        if (pattern.test(source)) problems.push(`${file} uses ${pattern}`);
      }
    }
    expect(seen.size).toBeGreaterThan(10);
    expect(problems).toEqual([]);
  });
});

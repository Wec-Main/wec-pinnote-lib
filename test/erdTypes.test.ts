import { describe, expect, it } from "vitest";
import {
  formatFieldType,
  needsLength,
  needsPrecision,
  typeCatalogFor,
  typesCompatible,
} from "../src/utils/erd/erdTypes";

const values = (engine: Parameters<typeof typeCatalogFor>[0]) =>
  typeCatalogFor(engine).map((option) => option.value);

describe("typeCatalogFor", () => {
  it("offers every type, grouped, for na", () => {
    const catalog = typeCatalogFor("na");
    expect(catalog).toHaveLength(41);
    expect(new Set(catalog.map((option) => option.group)).size).toBe(8);
    expect(catalog[0]).toEqual({ value: "smallint", label: "SMALLINT", group: "Numeric" });
    expect(values("na")).not.toContain("enum");
  });

  it("excludes MySQL-only types from postgres", () => {
    const postgres = values("postgres");
    for (const type of ["datetime", "year", "longtext", "blob", "binary"]) {
      expect(postgres).not.toContain(type);
    }
    expect(postgres).toContain("serial");
    expect(postgres).toContain("jsonb");
  });

  it("excludes Postgres-only types from mysql", () => {
    const mysql = values("mysql");
    for (const type of ["serial", "bytea", "jsonb", "timestamptz", "inet", "array", "xml"]) {
      expect(mysql).not.toContain(type);
    }
    expect(mysql).toContain("datetime");
    expect(mysql).toContain("longtext");
  });

  it("limits sqlite to its affinity types", () => {
    expect(values("sqlite").sort()).toEqual(
      [
        "integer",
        "real",
        "text",
        "blob",
        "numeric",
        "boolean",
        "date",
        "datetime",
        "timestamp",
        "json",
        "varchar",
        "char",
        "decimal",
        "double",
        "float",
        "bigint",
        "smallint",
      ].sort(),
    );
  });
});

describe("type helpers", () => {
  it("knows which types take a length or a precision", () => {
    expect(needsLength("varchar")).toBe(true);
    expect(needsLength("binary")).toBe(true);
    expect(needsLength("text")).toBe(false);
    expect(needsPrecision("decimal")).toBe(true);
    expect(needsPrecision("numeric")).toBe(true);
    expect(needsPrecision("integer")).toBe(false);
  });

  it("formats lengths and precisions", () => {
    expect(formatFieldType({ type: "varchar", length: 20 })).toBe("varchar(20)");
    expect(formatFieldType({ type: "numeric", precision: 8, scale: 2 })).toBe("numeric(8,2)");
    expect(formatFieldType({ type: "binary", length: 4 }, "BINARY")).toBe("BINARY(4)");
    expect(formatFieldType({ type: "text" })).toBe("text");
  });

  it("treats aliases as compatible and serial as distinct", () => {
    expect(typesCompatible({ type: "int4" }, { type: "integer" })).toBe(true);
    expect(typesCompatible({ type: "serial" }, { type: "integer" })).toBe(false);
  });
});

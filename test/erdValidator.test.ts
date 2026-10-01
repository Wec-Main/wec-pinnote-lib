import { describe, expect, it } from "vitest";
import type { ErdSnapshot } from "../src/utils/erd/erdEngine";
import { validateErd, type ErdIssueCode } from "../src/utils/erd/erdValidator";
import { blogDocument, entity, field, relationship } from "./erdFixtures";

function snapshot(overrides: Partial<ErdSnapshot> = {}): ErdSnapshot {
  return {
    engine: "postgres",
    entities: [],
    relationships: [],
    enums: [],
    notes: [],
    ...overrides,
  };
}

const pk = (id: string, name = "id") => field(id, { name, primaryKey: true, nullable: false });

function codes(input: ErdSnapshot): ErdIssueCode[] {
  return validateErd(input).issues.map((issue) => issue.code);
}

describe("validateErd", () => {
  it("accepts the sample blog model", () => {
    const { engine, entities, relationships, enums, notes } = blogDocument();
    const result = validateErd({ engine, entities, relationships, enums, notes });
    expect(result.errorCount).toBe(0);
    expect(result.valid).toBe(true);
  });

  it("counts errors and warnings separately", () => {
    const result = validateErd(snapshot({ entities: [entity("a", [], { name: "a" })] }));
    expect(result.warningCount).toBe(1);
    expect(result.errorCount).toBe(0);
    expect(result.valid).toBe(true);
  });

  it("flags duplicate entity names case-insensitively within a schema", () => {
    const found = codes(
      snapshot({
        entities: [
          entity("a", [pk("a1")], { name: "Users" }),
          entity("b", [pk("b1")], { name: "users" }),
          entity("c", [pk("c1")], { name: "users", schema: "other" }),
        ],
      }),
    );
    expect(found.filter((code) => code === "duplicate-entity-name")).toHaveLength(2);
  });

  it("flags empty entity and field names", () => {
    const found = codes(snapshot({ entities: [entity("a", [pk("a1", "  ")], { name: "" })] }));
    expect(found).toContain("empty-entity-name");
    expect(found).toContain("empty-field-name");
  });

  it("flags duplicate field names", () => {
    const found = codes(
      snapshot({
        entities: [entity("a", [pk("a1", "x"), field("a2", { name: "X" })], { name: "t" })],
      }),
    );
    expect(found.filter((code) => code === "duplicate-field-name")).toHaveLength(2);
  });

  it("warns about entities without primary key or without fields", () => {
    const found = codes(
      snapshot({
        entities: [
          entity("a", [field("a1")], { name: "nopk" }),
          entity("b", [], { name: "empty" }),
        ],
      }),
    );
    expect(found).toContain("entity-without-pk");
    expect(found).toContain("entity-without-fields");
  });

  it("flags a relationship that points at something missing", () => {
    const found = codes(
      snapshot({
        entities: [entity("a", [pk("a1")], { name: "a" })],
        relationships: [
          relationship("r", "a", "gone"),
          relationship("r2", "gone", "a"),
          relationship("r3", "a", "a"),
        ],
      }),
    );
    expect(found.filter((code) => code === "dangling-relationship")).toHaveLength(2);
  });

  it("flags enum problems", () => {
    const found = codes(
      snapshot({
        entities: [
          entity(
            "a",
            [
              pk("a1"),
              field("a2", { name: "kind", type: "text", enumId: "ghost" }),
              field("a3", { name: "other", type: "text" }),
            ],
            {
              name: "a",
            },
          ),
        ],
        enums: [
          { id: "e1", name: "dup", values: [] },
          { id: "e2", name: "DUP", values: ["x", "x"] },
        ],
      }),
    );
    expect(found).toContain("empty-enum");
    expect(found).toContain("duplicate-enum-value");
    expect(found.filter((code) => code === "duplicate-enum-name")).toHaveLength(2);
    expect(found.filter((code) => code === "missing-enum")).toHaveLength(1);
  });

  it("flags index problems", () => {
    const found = codes(
      snapshot({
        entities: [
          entity("a", [pk("a1")], {
            name: "a",
            indexes: [
              { id: "i1", name: "same", fieldIds: [], unique: false },
              { id: "i2", name: "same", fieldIds: ["ghost"], unique: false },
            ],
          }),
        ],
      }),
    );
    expect(found).toContain("index-without-fields");
    expect(found).toContain("index-missing-field");
    expect(found.filter((code) => code === "duplicate-index-name")).toHaveLength(2);
  });

  it("warns about invalid identifiers", () => {
    const found = codes(
      snapshot({
        entities: [
          entity(
            "a",
            [field("a1", { name: "one", primaryKey: true }), field("a2", { name: "bad name" })],
            {
              name: "1table",
            },
          ),
        ],
      }),
    );
    expect(found.filter((code) => code === "invalid-identifier")).toHaveLength(2);
  });

  it("gives every issue a unique id and the referenced entity or relationship", () => {
    const result = validateErd(
      snapshot({
        entities: [entity("a", [], { name: "" })],
        relationships: [relationship("r", "a", "gone")],
      }),
    );
    expect(new Set(result.issues.map((issue) => issue.id)).size).toBe(result.issues.length);
    expect(
      result.issues.find((issue) => issue.code === "dangling-relationship")?.relationshipId,
    ).toBe("r");
    expect(result.issues.find((issue) => issue.code === "empty-entity-name")?.entityId).toBe("a");
  });
});

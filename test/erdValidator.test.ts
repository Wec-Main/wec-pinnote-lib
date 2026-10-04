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

describe("validateErd: extended rules", () => {
  const severityOf = (input: ErdSnapshot, code: ErdIssueCode) =>
    validateErd(input).issues.find((issue) => issue.code === code)?.severity;

  const parent = entity("p", [pk("p_id")], { name: "parents" });
  const child = (type = "integer") =>
    entity("c", [pk("c_id"), field("c_pid", { name: "parent_id", type })], { name: "children" });
  const link = (overrides = {}) =>
    relationship("r", "p", "c", { sourceFieldId: "p_id", targetFieldId: "c_pid", ...overrides });

  it("warns on an empty model", () => {
    expect(codes(snapshot())).toEqual(["empty-model"]);
    expect(severityOf(snapshot(), "empty-model")).toBe("warning");
  });

  it("reports every issue with a hint where one helps", () => {
    const result = validateErd(snapshot({ entities: [entity("u", [], { name: "user" })] }));
    expect(result.issues.find((issue) => issue.code === "reserved-word")?.hint).toBeTruthy();
  });

  it("flags reserved words and names over the engine limit", () => {
    const long = "x".repeat(64);
    const found = codes(
      snapshot({
        entities: [
          entity("a", [pk("a_id"), field("a_f", { name: "order" })], { name: "user" }),
          entity("b", [pk("b_id")], { name: long }),
        ],
      }),
    );
    expect(found.filter((code) => code === "reserved-word")).toHaveLength(2);
    expect(found).toContain("name-too-long");
    expect(
      severityOf(
        snapshot({ entities: [entity("b", [pk("b_id")], { name: long })] }),
        "name-too-long",
      ),
    ).toBe("error");
  });

  it("flags mixed naming styles against the dominant one", () => {
    const found = validateErd(
      snapshot({
        entities: [
          entity("a", [pk("a1")], { name: "order_items" }),
          entity("b", [pk("b1")], { name: "customer_orders" }),
          entity("c", [pk("c1")], { name: "ProductCategory" }),
        ],
        relationships: [relationship("r1", "a", "b"), relationship("r2", "b", "c")],
      }),
    ).issues.filter((issue) => issue.code === "mixed-naming-style");
    expect(found).toHaveLength(1);
    expect(found[0]?.entityId).toBe("c");
  });

  it("checks field types against the database engine", () => {
    const model = (engine: ErdSnapshot["engine"], type: string, extra = {}) =>
      snapshot({
        engine,
        entities: [
          entity("a", [field("a_f", { name: "f", type, nullable: false, ...extra }), pk("a_id")], {
            name: "t",
          }),
        ],
      });
    expect(codes(model("postgres", "datetime"))).toContain("unsupported-type");
    expect(codes(model("mysql", "bytea"))).toContain("unsupported-type");
    expect(codes(model("na", "datetime"))).not.toContain("unsupported-type");
    expect(codes(model("mysql", "varchar"))).toContain("missing-length");
    expect(codes(model("postgres", "varchar"))).not.toContain("missing-length");
    expect(codes(model("postgres", "varchar", { length: 0 }))).toContain("invalid-length");
    expect(codes(model("postgres", "decimal", { precision: 4, scale: 6 }))).toContain(
      "invalid-precision",
    );
    expect(codes(model("postgres", "decimal", { precision: 10, scale: 2 }))).not.toContain(
      "invalid-precision",
    );
  });

  it("rejects a nullable primary key", () => {
    const found = validateErd(
      snapshot({
        entities: [entity("a", [field("a_id", { name: "id", primaryKey: true, nullable: true })])],
      }),
    ).issues.find((issue) => issue.code === "primary-key-nullable");
    expect(found?.severity).toBe("error");
    expect(found?.fieldId).toBe("a_id");
  });

  it("validates relationship fields, types, uniqueness and indexes", () => {
    const ok = snapshot({
      entities: [
        parent,
        entity("c", [pk("c_id"), field("c_pid", { name: "parent_id" })], {
          name: "children",
          indexes: [
            { id: "i", name: "children_parent_id_idx", fieldIds: ["c_pid"], unique: false },
          ],
        }),
      ],
      relationships: [link()],
    });
    expect(validateErd(ok).issues).toEqual([]);

    expect(
      codes(snapshot({ entities: [parent, child("uuid")], relationships: [link()] })),
    ).toContain("relationship-type-mismatch");
    expect(codes(snapshot({ entities: [parent, child()], relationships: [link()] }))).toContain(
      "foreign-key-without-index",
    );
    expect(
      codes(
        snapshot({
          entities: [parent, child()],
          relationships: [link({ targetFieldId: "gone" })],
        }),
      ),
    ).toContain("relationship-missing-field");
    const nonUnique = entity("p", [pk("p_pk", "pk"), field("p_id", { name: "code" })], {
      name: "parents",
    });
    expect(
      severityOf(
        snapshot({ entities: [nonUnique, child()], relationships: [link()] }),
        "referenced-field-not-unique",
      ),
    ).toBe("error");
  });

  it("flags duplicate, self and many-to-many relationships and orphan entities", () => {
    const found = codes(
      snapshot({
        entities: [parent, child(), entity("o", [pk("o_id")], { name: "loners" })],
        relationships: [
          link(),
          relationship("r2", "p", "c", { sourceFieldId: "p_id", targetFieldId: "c_pid" }),
          relationship("r3", "p", "p"),
          relationship("r4", "p", "c", { cardinality: "many-to-many" }),
        ],
      }),
    );
    expect(found).toContain("duplicate-relationship");
    expect(found).toContain("self-relationship");
    expect(found).toContain("many-to-many-without-join-table");
    expect(found).toContain("orphan-entity");
  });

  it("flags an enum that no field uses", () => {
    const found = codes(
      snapshot({
        entities: [entity("a", [pk("a1")], { name: "a" })],
        enums: [{ id: "e1", name: "unused", values: ["x"] }],
      }),
    );
    expect(found).toContain("unused-enum");
  });

  it("does not flag an enum that a field uses", () => {
    const found = codes(
      snapshot({
        entities: [
          entity("a", [pk("a1"), field("a2", { name: "kind", type: "text", enumId: "e1" })], {
            name: "a",
          }),
        ],
        enums: [{ id: "e1", name: "used", values: ["x"] }],
      }),
    );
    expect(found).not.toContain("unused-enum");
  });

  it("flags a field with both a generated expression and a default value", () => {
    const found = validateErd(
      snapshot({
        entities: [
          entity(
            "a",
            [
              pk("a1"),
              field("a2", {
                name: "total",
                defaultValue: "0",
                generated: { expression: "price * qty" },
              }),
            ],
            { name: "a" },
          ),
        ],
      }),
    ).issues.find((issue) => issue.code === "generated-default-conflict");
    expect(found?.severity).toBe("error");
    expect(found?.fieldId).toBe("a2");
  });

  it("flags a composite key whose source and target column counts differ", () => {
    const found = validateErd(
      snapshot({
        entities: [parent, child()],
        relationships: [link({ sourceFieldIds: ["p_id"], targetFieldIds: ["c_pid", "c_id"] })],
      }),
    ).issues.find((issue) => issue.code === "composite-key-length-mismatch");
    expect(found?.severity).toBe("error");
  });

  it("flags a circular chain of relationships once, excluding self-relationships", () => {
    const a = entity("a", [pk("a_id"), field("a_b", { name: "b_id" })], { name: "a" });
    const b = entity("b", [pk("b_id"), field("b_c", { name: "c_id" })], { name: "b" });
    const c = entity("c", [pk("c_id"), field("c_a", { name: "a_id" })], { name: "c" });
    const found = validateErd(
      snapshot({
        entities: [a, b, c],
        relationships: [
          relationship("r1", "a", "b", { sourceFieldId: "a_id", targetFieldId: "a_b" }),
          relationship("r2", "b", "c", { sourceFieldId: "b_id", targetFieldId: "b_c" }),
          relationship("r3", "c", "a", { sourceFieldId: "c_id", targetFieldId: "c_a" }),
          relationship("r4", "a", "a"),
        ],
      }),
    ).issues.filter((issue) => issue.code === "circular-relationship");
    expect(found).toHaveLength(1);
  });

  it("lists errors before warnings", () => {
    const severities = validateErd(
      snapshot({
        entities: [
          entity("a", [], { name: "user" }),
          entity("b", [field("b_f", { name: "x", type: "datetime" }), pk("b_id")], {
            name: "ok_name",
          }),
        ],
      }),
    ).issues.map((issue) => issue.severity);
    expect(severities).toEqual(
      [...severities].sort((a, b) => (a === b ? 0 : a === "error" ? -1 : 1)),
    );
    expect(severities[0]).toBe("error");
  });
});

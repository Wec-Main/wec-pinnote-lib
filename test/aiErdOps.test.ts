import { describe, expect, it } from "vitest";
import {
  AI_ERD_LIMITS,
  diffErd,
  parseErdOps,
  summarizeChanges,
  summarizeErd,
  type ErdOp,
} from "../src/ai/ops";
import { applyErdOps } from "../src/ai/ops/applyErdOps";
import type { ErdDocumentJSON } from "../src/types/dataModel.types";
import { getEntityRect, getNoteRect } from "../src/utils/erd/erdGeometry";
import { parseErdDocument } from "../src/utils/erd/erdSerialization";
import { rectsIntersect } from "../src/utils/flowchart/geometry";
import { blogDocument, entity, field } from "./erdFixtures";

function seqIds() {
  let n = 0;
  return (prefix: string) => `${prefix}_${++n}`;
}

function apply(ops: ErdOp[], doc: ErdDocumentJSON = blogDocument()) {
  return applyErdOps(doc, ops, { createId: seqIds() });
}

function ok(ops: ErdOp[], doc?: ErdDocumentJSON) {
  const result = apply(ops, doc);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result;
}

function errorsOf(ops: ErdOp[], doc?: ErdDocumentJSON) {
  const result = apply(ops, doc);
  if (result.ok) throw new Error("expected failure");
  return result.errors;
}

const ent = (doc: ErdDocumentJSON, name: string) => {
  const found = doc.entities.find((e) => e.name === name);
  if (!found) throw new Error(`no entity ${name}`);
  return found;
};

describe("applyErdOps: entities", () => {
  it("adds an entity shaped like the editor's, with a default id primary key", () => {
    const { document, idMap, diff } = ok([{ op: "addEntity", tempId: "$tags", name: "labels" }]);
    const tags = ent(document, "labels");
    expect(tags).toMatchObject({ schema: "public", indexes: [] });
    expect(tags.id).toMatch(/^entity_/);
    expect(tags.fields).toEqual([
      {
        id: expect.stringMatching(/^field_/),
        name: "id",
        type: "integer",
        nullable: false,
        primaryKey: true,
        unique: false,
      },
    ]);
    expect(idMap.$tags).toBe(tags.id);
    expect(diff.added).toEqual([tags.id]);
  });

  it("builds fields from input with editor defaults", () => {
    const { document, idMap } = ok([
      {
        op: "addEntity",
        tempId: "orders",
        name: "orders",
        comment: "Orders",
        fields: [
          { tempId: "$oid", name: "id", type: "uuid", primaryKey: true },
          { name: "note", type: "varchar", length: 80, defaultValue: "''" },
          { name: "role", type: "text", enum: "role_enum" },
        ],
      },
    ]);
    const orders = ent(document, "orders");
    expect(orders.comment).toBe("Orders");
    expect(orders.fields[0]).toMatchObject({ name: "id", nullable: false, primaryKey: true });
    expect(orders.fields[1]).toMatchObject({
      nullable: true,
      length: 80,
      defaultValue: "''",
      unique: false,
    });
    expect(orders.fields[2]?.enumId).toBe("role_enum");
    expect(idMap.$orders).toBe(orders.id);
    expect(idMap.$oid).toBe(orders.fields[0]?.id);
  });

  it("rejects duplicate entity names case-insensitively", () => {
    const errors = errorsOf([{ op: "addEntity", name: "Users" }]);
    expect(errors).toEqual([expect.objectContaining({ index: 0, code: "duplicate_name" })]);
  });

  it("rejects duplicate field names within an added entity", () => {
    const errors = errorsOf([
      {
        op: "addEntity",
        name: "x",
        fields: [
          { name: "a", type: "int" },
          { name: "A", type: "int" },
        ],
      },
    ]);
    expect(errors[0]?.code).toBe("duplicate_name");
  });

  it("renames, sets and clears entity properties", () => {
    const { document } = ok([
      {
        op: "updateEntity",
        entity: "users",
        patch: { name: "accounts", comment: null, schema: "auth" },
      },
    ]);
    const accounts = ent(document, "accounts");
    expect(accounts.comment).toBeUndefined();
    expect(accounts.schema).toBe("auth");
  });

  it("refuses a rename onto another entity's name", () => {
    expect(
      errorsOf([{ op: "updateEntity", entity: "users", patch: { name: "posts" } }])[0]?.code,
    ).toBe("duplicate_name");
  });

  it("cascades relationships when an entity is removed", () => {
    const before = blogDocument();
    const touching = before.relationships.filter(
      (r) => r.sourceEntityId === "users" || r.targetEntityId === "users",
    );
    expect(touching.length).toBeGreaterThan(0);
    const { document, diff } = ok([{ op: "removeEntity", entity: "users" }], before);
    expect(document.entities.some((e) => e.id === "users")).toBe(false);
    expect(
      document.relationships.some(
        (r) => r.sourceEntityId === "users" || r.targetEntityId === "users",
      ),
    ).toBe(false);
    expect(diff.removed).toEqual(expect.arrayContaining(["users", ...touching.map((r) => r.id)]));
  });
});

describe("applyErdOps: fields", () => {
  it("adds a field at a position and resolves its temp id later in the batch", () => {
    const { document } = ok([
      {
        op: "addField",
        entity: "users",
        tempId: "$nick",
        field: { name: "nick", type: "text" },
        index: 1,
      },
      { op: "updateField", entity: "users", field: "$nick", patch: { nullable: false } },
    ]);
    const users = ent(document, "users");
    expect(users.fields[1]).toMatchObject({ name: "nick", nullable: false });
  });

  it("updates a field and clears defaultValue / enum with null", () => {
    const { document, diff } = ok([
      {
        op: "updateField",
        entity: "users",
        field: "role",
        patch: { defaultValue: null, enum: null, type: "varchar" },
      },
    ]);
    const role = ent(document, "users").fields.find((f) => f.name === "role");
    expect(role?.defaultValue).toBeUndefined();
    expect(role?.enumId).toBeUndefined();
    expect(role?.type).toBe("varchar");
    expect(diff.changed).toContain("users.users_role");
  });

  it("removing a field strips index entries and relationship field refs", () => {
    const doc = blogDocument();
    const posts = doc.entities.find((e) => e.id === "posts")!;
    posts.indexes = [
      { id: "idx1", name: "idx_author", fieldIds: ["posts_author", "posts_id"], unique: false },
    ];
    doc.relationships = [
      {
        id: "rel_a",
        sourceEntityId: "users",
        sourceFieldId: "users_id",
        targetEntityId: "posts",
        targetFieldId: "posts_author",
        cardinality: "one-to-many",
        sourceOptional: false,
        targetOptional: true,
        onDelete: "no-action",
        onUpdate: "no-action",
      },
    ];
    const { document, diff } = ok(
      [{ op: "removeField", entity: "posts", field: "author_id" }],
      doc,
    );
    const after = ent(document, "posts");
    expect(after.indexes[0]?.fieldIds).toEqual(["posts_id"]);
    expect(document.relationships[0]?.targetFieldId).toBeUndefined();
    expect(document.relationships[0]?.sourceFieldId).toBe("users_id");
    expect(diff.removed).toContain("posts.posts_author");
  });

  it("moves a field, clamping the index like the editor", () => {
    const { document } = ok([{ op: "moveField", entity: "users", field: "id", toIndex: 99 }]);
    const names = ent(document, "users").fields.map((f) => f.name);
    expect(names[names.length - 1]).toBe("id");
  });
});

describe("applyErdOps: relationships, indexes, enums, notes", () => {
  it("adds a relationship with editor defaults between temp entities", () => {
    const { document, idMap } = ok([
      { op: "addEntity", tempId: "$a", name: "a" },
      {
        op: "addEntity",
        tempId: "$b",
        name: "b",
        fields: [{ tempId: "$fk", name: "a_id", type: "integer" }],
      },
      {
        op: "addRelationship",
        tempId: "$r",
        source: "$a",
        target: "$b",
        targetField: "$fk",
        cardinality: "one-to-many",
      },
    ]);
    const rel = document.relationships.find((r) => r.id === idMap.$r)!;
    expect(rel).toMatchObject({
      sourceEntityId: idMap.$a,
      targetEntityId: idMap.$b,
      targetFieldId: idMap.$fk,
      sourceOptional: false,
      targetOptional: true,
      onDelete: "no-action",
      onUpdate: "no-action",
    });
    expect(rel.id).toMatch(/^rel_/);
  });

  it("treats a repeated relationship between the same pair as already done", () => {
    const { document, idMap } = ok([
      {
        op: "addEntity",
        tempId: "$a",
        name: "a",
        fields: [
          { name: "id", type: "uuid", primaryKey: true },
          { name: "user_id", type: "uuid" },
        ],
      },
      {
        op: "addRelationship",
        tempId: "$r1",
        source: "$a",
        target: "users",
        cardinality: "one-to-one",
      },
      {
        op: "addRelationship",
        tempId: "$r2",
        source: "users",
        target: "$a",
        cardinality: "one-to-one",
      },
      {
        op: "addRelationship",
        source: "users",
        sourceField: "id",
        target: "$a",
        targetField: "user_id",
        cardinality: "one-to-many",
      },
    ]);
    const between = document.relationships.filter(
      (rel) => rel.sourceEntityId === idMap["$a"] || rel.targetEntityId === idMap["$a"],
    );
    expect(between).toHaveLength(1);
    expect(idMap["$r2"]).toBe(idMap["$r1"]);
    expect(between[0]!.sourceFieldId ?? between[0]!.targetFieldId).toBeDefined();
  });

  it("still refuses a second relationship through different fields", () => {
    const errors = errorsOf([
      {
        op: "addEntity",
        tempId: "$a",
        name: "a",
        fields: [
          { name: "id", type: "uuid", primaryKey: true },
          { name: "user_id", type: "uuid" },
          { name: "owner_id", type: "uuid" },
        ],
      },
      {
        op: "addRelationship",
        source: "users",
        sourceField: "id",
        target: "$a",
        targetField: "user_id",
        cardinality: "one-to-many",
      },
      {
        op: "addRelationship",
        source: "users",
        sourceField: "id",
        target: "$a",
        targetField: "owner_id",
        cardinality: "one-to-many",
      },
    ]);
    expect(errors).toEqual([expect.objectContaining({ index: 2, code: "invalid_connection" })]);
  });

  it("sets the model description", () => {
    const { document } = ok([
      { op: "setModelDescription", description: "  Blog platform with users and posts.  " },
    ]);
    expect(document.meta.description).toBe("Blog platform with users and posts.");
    expect(errorsOf([{ op: "setModelDescription", description: "   " }])).toEqual([
      expect.objectContaining({ code: "invalid_value" }),
    ]);
  });

  it("renames the data model", () => {
    const { document } = ok([{ op: "setModelName", name: "  Online Shop Orders " }]);
    expect(document.meta.name).toBe("Online Shop Orders");
    expect(errorsOf([{ op: "setModelName", name: "  " }])).toEqual([
      expect.objectContaining({ code: "invalid_value" }),
    ]);
  });

  it("updates and removes relationships", () => {
    const doc = blogDocument();
    const relId = doc.relationships[0]!.id;
    const updated = ok(
      [
        {
          op: "updateRelationship",
          relationship: relId,
          patch: { cardinality: "one-to-one", onDelete: "cascade", name: "fk_x" },
        },
      ],
      doc,
    );
    expect(updated.document.relationships[0]).toMatchObject({
      cardinality: "one-to-one",
      onDelete: "cascade",
      name: "fk_x",
    });
    const removed = ok([{ op: "removeRelationship", relationship: relId }], doc);
    expect(removed.document.relationships.some((r) => r.id === relId)).toBe(false);
  });

  it("adds an index with the editor's default name, updates and removes it", () => {
    const added = ok([
      { op: "addIndex", entity: "users", tempId: "$i", fields: ["email"], unique: true },
    ]);
    const index = ent(added.document, "users").indexes[0]!;
    expect(index).toMatchObject({ name: "idx_users_1", fieldIds: ["users_email"], unique: true });
    const chained = ok([
      { op: "addIndex", entity: "users", tempId: "$i", fields: ["email"] },
      {
        op: "updateIndex",
        entity: "users",
        index: "$i",
        patch: { fields: ["email", "id"], name: "idx_email_id" },
      },
    ]);
    expect(ent(chained.document, "users").indexes[0]).toMatchObject({
      name: "idx_email_id",
      fieldIds: ["users_email", "users_id"],
    });
    const removed = ok([
      { op: "addIndex", entity: "users", tempId: "$i", fields: ["email"] },
      { op: "removeIndex", entity: "users", index: "$i" },
    ]);
    expect(ent(removed.document, "users").indexes).toEqual([]);
  });

  it("validates index fields", () => {
    const errors = errorsOf([{ op: "addIndex", entity: "users", fields: ["email", "email"] }]);
    expect(errors[0]?.code).toBe("invalid_value");
    expect(errorsOf([{ op: "addIndex", entity: "users", fields: ["nope"] }])[0]?.code).toBe(
      "not_found",
    );
  });

  it("adds, updates and removes enums (clearing field links)", () => {
    const added = ok([
      { op: "addEnum", tempId: "$status", name: "status", values: ["open", "closed"] },
      { op: "addField", entity: "posts", field: { name: "status", type: "text", enum: "$status" } },
    ]);
    const statusId = added.idMap.$status;
    expect(ent(added.document, "posts").fields.at(-1)?.enumId).toBe(statusId);
    const updated = ok([{ op: "updateEnum", enum: "role_enum", patch: { values: ["a", "b"] } }]);
    expect(updated.document.enums.find((e) => e.id === "role_enum")?.values).toEqual(["a", "b"]);
    const removed = ok([{ op: "removeEnum", enum: "role_enum" }]);
    expect(
      ent(removed.document, "users").fields.find((f) => f.name === "role")?.enumId,
    ).toBeUndefined();
  });

  it("rejects duplicate enum values and names", () => {
    expect(errorsOf([{ op: "addEnum", name: "e", values: ["a", "a"] }])[0]?.code).toBe(
      "invalid_value",
    );
    const existing = blogDocument().enums[0]!.name;
    expect(errorsOf([{ op: "addEnum", name: existing, values: [] }])[0]?.code).toBe(
      "duplicate_name",
    );
  });

  it("adds, updates and removes notes", () => {
    const added = ok([
      { op: "addNote", tempId: "$n", text: "Remember", near: "users", color: "#fde68a" },
    ]);
    const note = added.document.notes.find((n) => n.id === added.idMap.$n)!;
    expect(note).toMatchObject({ text: "Remember", width: 200, height: 120, color: "#fde68a" });
    const updated = ok([
      { op: "addNote", tempId: "$n", text: "x" },
      { op: "updateNote", note: "$n", patch: { text: "y" } },
    ]);
    expect(updated.document.notes.at(-1)?.text).toBe("y");
    const removed = ok([
      { op: "addNote", tempId: "$n", text: "x" },
      { op: "removeNote", note: "$n" },
    ]);
    expect(removed.document.notes).toHaveLength(blogDocument().notes.length);
  });

  it("sets the engine and reports a document-level change", () => {
    const { document, diff } = ok([{ op: "setEngine", engine: "mysql" }]);
    expect(document.engine).toBe("mysql");
    expect(diff.changed).toEqual(["document"]);
  });

  it("auto-lays out every entity", () => {
    const { document } = ok([{ op: "autoLayout", mode: "grid" }]);
    const rects = document.entities.map(getEntityRect);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(rectsIntersect(rects[i]!, rects[j]!)).toBe(false);
      }
    }
  });
});

describe("applyErdOps: references", () => {
  it("resolves by id, then temp id, then unique exact name", () => {
    const { document } = ok([
      { op: "updateEntity", entity: "users", patch: { comment: "by id" } },
      { op: "updateEntity", entity: " posts ", patch: { comment: "by trimmed name" } },
    ]);
    expect(ent(document, "users").comment).toBe("by id");
    expect(ent(document, "posts").comment).toBe("by trimmed name");
  });

  it("is case-sensitive for name refs", () => {
    expect(errorsOf([{ op: "removeEntity", entity: "USERS" }])[0]?.code).toBe("not_found");
  });

  it("prefers an id over a name", () => {
    const doc: ErdDocumentJSON = {
      ...blogDocument(),
      entities: [
        entity("a", [field("f1")], { name: "b" }),
        entity("b", [field("f2")], { name: "zzz" }),
      ],
      relationships: [],
    };
    const { document } = ok([{ op: "removeEntity", entity: "b" }], doc);
    expect(document.entities.map((e) => e.id)).toEqual(["a"]);
  });

  it("reports ambiguous name refs", () => {
    const doc: ErdDocumentJSON = {
      ...blogDocument(),
      entities: [
        entity("e1", [field("x1", { name: "dup" }), field("x2", { name: "dup" })], { name: "one" }),
      ],
      relationships: [],
    };
    const errors = errorsOf([{ op: "removeField", entity: "one", field: "dup" }], doc);
    expect(errors[0]?.code).toBe("ambiguous_ref");
  });

  it("reports a temp id declared twice", () => {
    const errors = errorsOf([
      { op: "addEntity", tempId: "$x", name: "x1" },
      { op: "addEnum", tempId: "x", name: "x2", values: [] },
    ]);
    expect(errors).toEqual([expect.objectContaining({ index: 1, code: "duplicate_temp_id" })]);
  });

  it("explains refs to a temp id whose op failed, and to the wrong kind", () => {
    const errors = errorsOf([
      { op: "addEntity", tempId: "$bad", name: "users" },
      { op: "addField", entity: "$bad", field: { name: "a", type: "int" } },
      { op: "addEnum", tempId: "$e", name: "en", values: [] },
      { op: "removeEntity", entity: "$e" },
    ]);
    expect(errors.map((e) => [e.index, e.code])).toEqual([
      [0, "duplicate_name"],
      [1, "not_found"],
      [3, "not_found"],
    ]);
    expect(errors[1]?.message).toContain("op #0 failed");
    expect(errors[2]?.message).toContain("is a enum");
  });

  it("does not resolve a field temp id in a different entity", () => {
    const errors = errorsOf([
      { op: "addField", entity: "users", tempId: "$f", field: { name: "a", type: "int" } },
      { op: "removeField", entity: "posts", field: "$f" },
    ]);
    expect(errors[0]?.code).toBe("not_found");
  });
});

describe("applyErdOps: all or nothing", () => {
  it("collects every error and leaves the input untouched", () => {
    const input = blogDocument();
    const snapshot = JSON.stringify(input);
    const errors = errorsOf(
      [
        { op: "addEntity", name: "fine" },
        { op: "removeEntity", entity: "missing" },
        { op: "addEnum", name: "e", values: ["a", "a"] },
        { op: "setEngine", engine: "oracle" as never },
      ],
      input,
    );
    expect(errors.map((e) => e.index)).toEqual([1, 2, 3]);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("enforces the limits", () => {
    const tooMany = Array.from({ length: AI_ERD_LIMITS.maxOpsPerBatch + 1 }, (_, i): ErdOp => ({
      op: "addEnum",
      name: `e${i}`,
      values: [],
    }));
    expect(errorsOf(tooMany).some((e) => e.code === "limit_exceeded" && e.index === -1)).toBe(true);
    const fields = Array.from({ length: AI_ERD_LIMITS.maxFieldsPerEntity + 1 }, (_, i) => ({
      name: `f${i}`,
      type: "int",
    }));
    expect(errorsOf([{ op: "addEntity", name: "wide", fields }])[0]?.code).toBe("limit_exceeded");
  });
});

describe("applyErdOps: placement and round trip", () => {
  it("places new entities right of the right-most entity without overlaps", () => {
    const { document } = ok([
      {
        op: "addEntity",
        name: "n1",
        fields: Array.from({ length: 12 }, (_, i) => ({ name: `c${i}`, type: "int" })),
      },
      { op: "addEntity", name: "n2" },
      { op: "addEntity", name: "n3", near: "users" },
      { op: "addNote", text: "hi", near: "n3" },
    ]);
    const before = blogDocument();
    const maxRight = Math.max(
      ...before.entities.map((e) => getEntityRect(e).x + getEntityRect(e).width),
    );
    expect(ent(document, "n1").position.x).toBeGreaterThan(maxRight);
    const rects = [...document.entities.map(getEntityRect), ...document.notes.map(getNoteRect)];
    const newIds = new Set(["n1", "n2", "n3"].map((name) => ent(document, name).id));
    document.entities.forEach((e, i) => {
      if (!newIds.has(e.id)) return;
      rects.forEach((other, j) => {
        if (i !== j) expect(rectsIntersect(rects[i]!, other)).toBe(false);
      });
    });
    expect(ent(document, "n3").position.x).toBeGreaterThan(ent(document, "users").position.x);
  });

  it("lays out a generated model in layers instead of one long row", () => {
    const empty: ErdDocumentJSON = { ...blogDocument(), entities: [], relationships: [] };
    const names = ["users", "orders", "items", "products", "payments", "addresses"];
    const { document } = ok(
      names.map((name) => ({ op: "addEntity", name, tempId: `$${name}` }) as ErdOp),
      empty,
    );
    const rects = document.entities.map(getEntityRect);
    const rows = new Set(rects.map((rect) => rect.y));
    expect(rows.size).toBeGreaterThan(1);
    rects.forEach((r, i) =>
      rects.forEach((o, j) => {
        if (i !== j) expect(rectsIntersect(r, o)).toBe(false);
      }),
    );
  });

  it("survives parseErdDocument unchanged", () => {
    const { document } = ok([
      {
        op: "addEntity",
        tempId: "$t",
        name: "t",
        fields: [{ name: "id", type: "uuid", primaryKey: true }],
      },
      { op: "addRelationship", source: "users", target: "$t", cardinality: "one-to-many" },
      { op: "addNote", text: "n" },
    ]);
    expect(parseErdDocument(JSON.parse(JSON.stringify(document)))).toEqual(document);
  });

  it("warns about validator issues the batch introduces", () => {
    const result = ok([
      { op: "addEntity", name: "bad name", fields: [{ name: "x", type: "int" }] },
    ]);
    expect(result.warnings.some((w) => w.includes("bad name"))).toBe(true);
  });
});

describe("parseErdOps", () => {
  it("accepts every op kind and keeps only declared keys", () => {
    const ops: ErdOp[] = [
      {
        op: "addEntity",
        tempId: "$a",
        name: "a",
        schema: "s",
        comment: "c",
        fields: [{ name: "id", type: "int", tempId: "$f" }],
        near: "users",
      },
      { op: "updateEntity", entity: "a", patch: { name: "b", schema: null, comment: null } },
      { op: "removeEntity", entity: "a" },
      {
        op: "addField",
        entity: "a",
        tempId: "$g",
        field: { name: "x", type: "int", enum: null },
        index: 0,
      },
      { op: "updateField", entity: "a", field: "x", patch: { defaultValue: null } },
      { op: "removeField", entity: "a", field: "x" },
      { op: "moveField", entity: "a", field: "x", toIndex: 0 },
      {
        op: "addRelationship",
        source: "a",
        target: "b",
        cardinality: "one-to-one",
        onDelete: "cascade",
      },
      { op: "updateRelationship", relationship: "r", patch: { sourceField: null } },
      { op: "removeRelationship", relationship: "r" },
      { op: "addIndex", entity: "a", fields: ["x"] },
      { op: "updateIndex", entity: "a", index: "i", patch: { unique: true } },
      { op: "removeIndex", entity: "a", index: "i" },
      { op: "addEnum", name: "e", values: ["v"] },
      { op: "updateEnum", enum: "e", patch: { values: [] } },
      { op: "removeEnum", enum: "e" },
      { op: "addNote", text: "t" },
      { op: "updateNote", note: "n", patch: { color: "red" } },
      { op: "removeNote", note: "n" },
      { op: "setEngine", engine: "postgres" },
      { op: "autoLayout" },
    ];
    const result = parseErdOps(ops);
    expect(result).toEqual({ ok: true, ops });
  });

  it("reports every shape problem with its index", () => {
    const result = parseErdOps([
      { op: "addEntity" },
      { op: "nope" },
      "x",
      { op: "addRelationship", source: "a", target: "b", cardinality: "lots" },
      { op: "removeEntity", entity: "a", extra: 1 },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => [e.index, e.code])).toEqual([
      [0, "invalid_shape"],
      [1, "unknown_op"],
      [2, "invalid_shape"],
      [3, "invalid_value"],
      [4, "invalid_shape"],
    ]);
  });

  it("rejects non-arrays and oversized batches", () => {
    expect(parseErdOps({}).ok).toBe(false);
    const big = parseErdOps(
      Array.from({ length: AI_ERD_LIMITS.maxOpsPerBatch + 1 }, () => ({ op: "autoLayout" })),
    );
    expect(big.ok === false && big.errors[0]?.code).toBe("limit_exceeded");
  });
});

describe("diffErd / summaries", () => {
  it("lists added, changed and removed ids, fields as entityId.fieldId", () => {
    const before = blogDocument();
    const after = JSON.parse(JSON.stringify(before)) as ErdDocumentJSON;
    after.entities[0]!.name = "renamed";
    after.entities[1]!.fields.push(field("new_f"));
    after.entities[1]!.fields.shift();
    after.notes = [];
    const diff = diffErd(before, after);
    expect(diff.changed).toContain(after.entities[0]!.id);
    expect(diff.added).toContain(`${after.entities[1]!.id}.new_f`);
    expect(diff.removed).toContain(
      `${before.entities[1]!.id}.${before.entities[1]!.fields[0]!.id}`,
    );
    expect(diff.removed).toEqual(expect.arrayContaining(before.notes.map((n) => n.id)));
    expect(diffErd(before, before)).toEqual({ added: [], changed: [], removed: [] });
    expect(summarizeChanges(diff)).toEqual({
      added: diff.added.length,
      changed: diff.changed.length,
      removed: diff.removed.length,
    });
  });

  it("summarizes a model, with field detail only for requested entities", () => {
    const doc = blogDocument();
    const all = summarizeErd(doc);
    expect(all.entityCount).toBe(doc.entities.length);
    expect(all.entities[0]?.fields).toBeUndefined();
    expect(all.truncated).toBe(false);
    const one = summarizeErd(doc, { entityIds: ["users"] });
    expect(one.entities).toHaveLength(1);
    expect(one.entities[0]?.fields?.find((f) => f.name === "role")?.enum).toBeDefined();
    expect(summarizeErd(doc, { maxEntities: 1 }).truncated).toBe(true);
  });
});

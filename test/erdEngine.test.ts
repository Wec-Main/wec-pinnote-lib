import { describe, expect, it, vi } from "vitest";
import { ErdEngine } from "../src/utils/erd/erdEngine";
import { blogDocument, entity, field, relationship } from "./erdFixtures";

function blogEngine() {
  return new ErdEngine({ initialDocument: blogDocument() });
}

describe("document lifecycle", () => {
  it("exposes the loaded document and name through toJSON", () => {
    const json = blogEngine().toJSON();
    expect(json.version).toBe(1);
    expect(json.engine).toBe("postgres");
    expect(json.entities).toHaveLength(3);
    expect(json.meta.name).toBe("Blog");
  });

  it("keeps unknown meta keys and writes the current name", () => {
    const engine = new ErdEngine({
      initialDocument: { ...blogDocument(), meta: { name: "A", custom: 7 } },
    });
    engine.setName("B");
    expect(engine.toJSON().meta).toEqual({ name: "B", custom: 7 });
  });

  it("loadDocument replaces everything and clears history and selection", () => {
    const engine = blogEngine();
    engine.addEntity();
    engine.select("entity", "users");
    engine.loadDocument({
      ...blogDocument(),
      entities: [],
      relationships: [],
      meta: { name: "Fresh" },
    });
    const state = engine.getState();
    expect(state.entities).toEqual([]);
    expect(state.name).toBe("Fresh");
    expect(state.canUndo).toBe(false);
    expect(state.selection.entityIds.size).toBe(0);
  });

  it("defaults a new engine instance to na", () => {
    expect(new ErdEngine().getState().engine).toBe("na");
  });

  it("changes engine as an undoable edit", () => {
    const engine = blogEngine();
    engine.setEngine("mysql");
    expect(engine.getState().engine).toBe("mysql");
    engine.undo();
    expect(engine.getState().engine).toBe("postgres");
  });
});

describe("entities", () => {
  it("creates an entity in the public schema with a primary key and a unique name", () => {
    const engine = new ErdEngine();
    const first = engine.addEntity({ position: { x: 10, y: 20 } });
    const second = engine.addEntity();
    expect(first.position).toEqual({ x: 10, y: 20 });
    expect(first.schema).toBe("public");
    expect(first.fields).toHaveLength(1);
    expect(first.fields[0]).toMatchObject({
      name: "id",
      type: "integer",
      primaryKey: true,
      nullable: false,
    });
    expect(second.name).not.toBe(first.name);
  });

  it("updates an entity without changing its id", () => {
    const engine = blogEngine();
    engine.updateEntity("users", { name: "accounts", id: "ignored" } as never);
    expect(engine.getEntity("users")?.name).toBe("accounts");
    expect(engine.getEntity("ignored")).toBeUndefined();
  });

  it("removes entities together with their relationships", () => {
    const engine = blogEngine();
    engine.removeEntities(["posts"]);
    expect(engine.getState().entities.map((e) => e.id)).toEqual(["users", "tags"]);
    expect(engine.getState().relationships).toEqual([]);
  });

  it("duplicates entities with fresh ids and remapped index fields", () => {
    const engine = blogEngine();
    const [copy] = engine.duplicateEntities(["posts"]);
    expect(copy).toBeDefined();
    expect(copy?.id).not.toBe("posts");
    expect(copy?.name).not.toBe("posts");
    expect(copy?.position).toEqual({ x: 40, y: 40 });
    const copiedFieldIds = copy?.fields.map((f) => f.id) ?? [];
    expect(copiedFieldIds).not.toContain("posts_id");
    expect(copy?.indexes[0]?.fieldIds.every((id) => copiedFieldIds.includes(id))).toBe(true);
    expect(engine.getState().selection.entityIds.has(copy?.id ?? "")).toBe(true);
    expect(engine.getState().relationships).toHaveLength(2);
  });

  it("moves entities and notes in one step", () => {
    const engine = blogEngine();
    const note = engine.addNote();
    engine.setNodePositions({ users: { x: 5, y: 6 }, [note.id]: { x: 7, y: 8 } });
    expect(engine.getEntity("users")?.position).toEqual({ x: 5, y: 6 });
    expect(engine.getNote(note.id)?.position).toEqual({ x: 7, y: 8 });
    engine.undo();
    expect(engine.getEntity("users")?.position).toEqual({ x: 0, y: 0 });
  });

  it("does not record history when positions are unchanged", () => {
    const engine = blogEngine();
    engine.setNodePositions({ users: { x: 0, y: 0 } });
    expect(engine.getState().canUndo).toBe(false);
  });
});

describe("fields and indexes", () => {
  it("adds, updates and reorders fields", () => {
    const engine = blogEngine();
    const added = engine.addField("tags", { name: "slug", type: "varchar" });
    expect(added?.name).toBe("slug");
    engine.updateField("tags", added?.id ?? "", { nullable: false });
    expect(engine.getEntity("tags")?.fields.at(-1)?.nullable).toBe(false);
    engine.moveField("tags", added?.id ?? "", 0);
    expect(engine.getEntity("tags")?.fields[0]?.id).toBe(added?.id);
    expect(engine.addField("missing")).toBeNull();
  });

  it("removing a field clears index field lists and keeps relationships", () => {
    const engine = blogEngine();
    engine.removeField("posts", "posts_author");
    expect(engine.getEntity("posts")?.fields.some((f) => f.id === "posts_author")).toBe(false);
    expect(engine.getEntity("posts")?.indexes[0]?.fieldIds).toEqual([]);
    expect(engine.getState().relationships.map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("manages indexes", () => {
    const engine = blogEngine();
    const index = engine.addIndex("tags", { fieldIds: ["tags_label"], unique: true });
    expect(index?.unique).toBe(true);
    engine.updateIndex("tags", index?.id ?? "", { name: "uq_label" });
    expect(engine.getEntity("tags")?.indexes[0]?.name).toBe("uq_label");
    engine.removeIndex("tags", index?.id ?? "");
    expect(engine.getEntity("tags")?.indexes).toEqual([]);
  });
});

describe("enums and notes", () => {
  it("removing an enum clears enumId on fields that used it", () => {
    const engine = blogEngine();
    engine.removeEnum("role_enum");
    expect(engine.getState().enums).toEqual([]);
    expect(
      engine.getEntity("users")?.fields.find((f) => f.id === "users_role")?.enumId,
    ).toBeUndefined();
  });

  it("adds and updates enums and notes", () => {
    const engine = new ErdEngine();
    const status = engine.addEnum({ values: ["a"] });
    engine.updateEnum(status.id, { values: ["a", "b"] });
    expect(engine.getEnum(status.id)?.values).toEqual(["a", "b"]);
    const note = engine.addNote({ text: "hello" });
    engine.updateNote(note.id, { text: "bye" });
    expect(engine.getNote(note.id)?.text).toBe("bye");
    engine.removeNotes([note.id]);
    expect(engine.getState().notes).toEqual([]);
  });
});

describe("relationships", () => {
  it("rejects unknown entities and duplicate pairs in either direction", () => {
    const engine = blogEngine();
    expect(engine.canConnect("users", "nope").valid).toBe(false);
    expect(engine.canConnect("nope", "posts").valid).toBe(false);
    expect(engine.canConnect("users", "posts").valid).toBe(false);
    expect(engine.canConnect("posts", "users").valid).toBe(false);
    expect(engine.canConnect("users", "tags").valid).toBe(true);
  });

  it("allows one self-reference per entity", () => {
    const engine = blogEngine();
    expect(engine.canConnect("users", "users").valid).toBe(true);
    expect(engine.addRelationship("users", "users")).not.toBeNull();
    expect(engine.canConnect("users", "users").valid).toBe(false);
    expect(engine.addRelationship("users", "users")).toBeNull();
  });

  it("creates entity-level relationships with one-to-many and optional-child defaults", () => {
    const engine = blogEngine();
    const created = engine.addRelationship("users", "tags");
    expect(created).toMatchObject({
      cardinality: "one-to-many",
      targetOptional: true,
      sourceOptional: false,
      onDelete: "no-action",
      onUpdate: "no-action",
      sourceEntityId: "users",
      targetEntityId: "tags",
    });
    expect(created?.sourceFieldId).toBeUndefined();
    expect(created?.targetFieldId).toBeUndefined();
  });

  it("applies the optional input over the defaults", () => {
    const created = blogEngine().addRelationship("users", "tags", {
      cardinality: "one-to-one",
      onDelete: "cascade",
    });
    expect(created).toMatchObject({ cardinality: "one-to-one", onDelete: "cascade" });
  });

  it("returns null instead of adding an invalid relationship", () => {
    const engine = blogEngine();
    expect(engine.addRelationship("users", "posts")).toBeNull();
    expect(engine.getState().relationships).toHaveLength(2);
  });

  it("updates and removes relationships", () => {
    const engine = blogEngine();
    engine.updateRelationship("r1", { cardinality: "one-to-one", onDelete: "set-null" });
    expect(engine.getRelationship("r1")).toMatchObject({
      cardinality: "one-to-one",
      onDelete: "set-null",
    });
    engine.removeRelationships(["r1"]);
    expect(engine.getRelationship("r1")).toBeUndefined();
  });

  it("drives a connection gesture from start to a new relationship", () => {
    const engine = blogEngine();
    engine.startConnection("users", { x: 1, y: 1 });
    expect(engine.getState().connection).toMatchObject({ fromEntityId: "users", valid: false });
    engine.updateConnection({ x: 2, y: 2 }, "tags");
    expect(engine.getState().connection).toMatchObject({
      valid: true,
      candidate: "tags",
      pointer: { x: 2, y: 2 },
    });
    const created = engine.endConnection();
    expect(created).toMatchObject({ sourceEntityId: "users", targetEntityId: "tags" });
    expect(engine.getState().connection).toBeNull();
  });

  it("flags an invalid candidate and creates nothing on release", () => {
    const engine = blogEngine();
    engine.startConnection("users", { x: 0, y: 0 });
    engine.updateConnection({ x: 0, y: 0 }, "posts");
    expect(engine.getState().connection?.valid).toBe(false);
    expect(engine.getState().connection?.reason).toBeTruthy();
    expect(engine.endConnection()).toBeNull();
    expect(engine.getState().relationships).toHaveLength(2);
  });

  it("cancels a connection", () => {
    const engine = blogEngine();
    engine.startConnection("users", { x: 0, y: 0 });
    engine.cancelConnection();
    expect(engine.getState().connection).toBeNull();
  });
});

describe("selection", () => {
  it("selects, toggles additively and clears", () => {
    const engine = blogEngine();
    engine.select("entity", "users");
    engine.select("entity", "posts", true);
    expect([...engine.getState().selection.entityIds]).toEqual(["users", "posts"]);
    engine.select("entity", "users", true);
    expect([...engine.getState().selection.entityIds]).toEqual(["posts"]);
    engine.clearSelection();
    expect(engine.getState().selection.entityIds.size).toBe(0);
  });

  it("selecting an enum replaces other selections", () => {
    const engine = blogEngine();
    engine.select("entity", "users");
    engine.select("enum", "role_enum");
    expect(engine.getState().selection.enumId).toBe("role_enum");
    expect(engine.getState().selection.entityIds.size).toBe(0);
  });

  it("drops selected ids that no longer exist", () => {
    const engine = blogEngine();
    engine.select("entity", "users");
    engine.removeEntities(["users"]);
    expect(engine.getState().selection.entityIds.size).toBe(0);
  });

  it("selects everything and by rectangle", () => {
    const engine = blogEngine();
    engine.setNodePositions({
      users: { x: 0, y: 0 },
      posts: { x: 1000, y: 0 },
      tags: { x: 2000, y: 0 },
    });
    engine.selectInRect({ x: -10, y: -10, width: 400, height: 100 });
    expect([...engine.getState().selection.entityIds]).toEqual(["users"]);
    engine.selectInRect({ x: 990, y: -10, width: 400, height: 100 }, true);
    expect([...engine.getState().selection.entityIds]).toEqual(["users", "posts"]);
    engine.selectAll();
    expect(engine.getState().selection.entityIds.size).toBe(3);
    expect(engine.getState().selection.relationshipIds.size).toBe(2);
  });

  it("deletes the whole selection as a single undoable step", () => {
    const engine = blogEngine();
    engine.setSelection({ entityIds: ["posts"], relationshipIds: ["r2"], enumId: null });
    engine.deleteSelection();
    expect(engine.getState().entities.map((e) => e.id)).toEqual(["users", "tags"]);
    engine.undo();
    expect(engine.getState().entities).toHaveLength(3);
    expect(engine.getState().relationships).toHaveLength(2);
  });
});

describe("history", () => {
  it("undoes and redoes edits", () => {
    const engine = blogEngine();
    engine.addEntity({ name: "extra" });
    expect(engine.getState().canUndo).toBe(true);
    engine.undo();
    expect(engine.getState().entities).toHaveLength(3);
    expect(engine.getState().canRedo).toBe(true);
    engine.redo();
    expect(engine.getState().entities).toHaveLength(4);
  });

  it("groups edits made during an interaction into one history entry", () => {
    const engine = blogEngine();
    engine.beginInteraction();
    engine.updateEntity("users", { name: "a" });
    engine.updateEntity("users", { name: "b" });
    engine.endInteraction();
    engine.undo();
    expect(engine.getEntity("users")?.name).toBe("users");
    expect(engine.getState().canUndo).toBe(false);
  });

  it("restores the starting snapshot when an interaction is cancelled", () => {
    const engine = blogEngine();
    engine.beginInteraction();
    engine.updateEntity("users", { name: "temp" });
    engine.cancelInteraction();
    expect(engine.getEntity("users")?.name).toBe("users");
    expect(engine.getState().canUndo).toBe(false);
  });

  it("ignores edits while read only", () => {
    const engine = new ErdEngine({ initialDocument: blogDocument(), readOnly: true });
    engine.addEntity();
    engine.removeEntities(["users"]);
    expect(engine.getState().entities).toHaveLength(3);
  });

  it("emits change only when the document content changes", () => {
    const engine = blogEngine();
    const onChange = vi.fn();
    engine.on("change", onChange);
    engine.select("entity", "users");
    engine.panBy(10, 10);
    expect(onChange).not.toHaveBeenCalled();
    engine.addEntity();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("viewport", () => {
  it("pans, zooms around a point and clamps zoom", () => {
    const engine = blogEngine();
    engine.setCanvasSize({ width: 800, height: 600 });
    engine.setViewport({ x: 0, y: 0, zoom: 1 });
    engine.panBy(5, 7);
    expect(engine.getState().viewport).toMatchObject({ x: 5, y: 7 });
    engine.zoomTo(10);
    expect(engine.getState().viewport.zoom).toBeLessThanOrEqual(2.5);
    engine.zoomTo(0.0001);
    expect(engine.getState().viewport.zoom).toBeGreaterThanOrEqual(0.1);
  });

  it("converts screen points to flow coordinates", () => {
    const engine = blogEngine();
    engine.setViewport({ x: 100, y: 50, zoom: 2 });
    expect(engine.screenToFlow({ x: 300, y: 250 })).toEqual({ x: 100, y: 100 });
  });

  it("fits the view around the diagram once the canvas is measured", () => {
    const engine = blogEngine();
    engine.setCanvasSize({ width: 1000, height: 700 });
    const { viewport } = engine.getState();
    expect(viewport.zoom).toBeGreaterThan(0);
    expect(viewport.zoom).toBeLessThanOrEqual(1.25);
  });

  it("centres on a point", () => {
    const engine = blogEngine();
    engine.setCanvasSize({ width: 800, height: 600 });
    engine.centerOn({ x: 100, y: 100 }, 1);
    expect(engine.getState().viewport).toEqual({ x: 300, y: 200, zoom: 1 });
  });
});

describe("layout and validation", () => {
  it("applies a layout that separates entities", () => {
    const engine = blogEngine();
    engine.applyLayout("grid");
    const positions = engine.getState().entities.map((e) => `${e.position.x},${e.position.y}`);
    expect(new Set(positions).size).toBe(3);
    engine.undo();
    expect(engine.getEntity("users")?.position).toEqual({ x: 0, y: 0 });
  });

  it("records validation results and issue severities", () => {
    const engine = new ErdEngine({
      initialDocument: {
        entities: [
          entity("a", [field("f1", { name: "id" })], { name: "dup" }),
          entity("b", [], { name: "dup" }),
        ],
        relationships: [relationship("r", "a", "gone")],
      },
    });
    const result = engine.validate();
    expect(result.valid).toBe(false);
    expect(engine.getState().validation).toBe(result);
    expect(engine.getState().issueEntityIds.get("a")).toBe("error");
    expect(engine.getState().issueRelationshipIds.get("r")).toBe("error");
    engine.clearValidation();
    expect(engine.getState().validation).toBeNull();
    expect(engine.getState().issueEntityIds.size).toBe(0);
  });
});

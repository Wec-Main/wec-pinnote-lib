import { describe, expect, it, vi } from "vitest";
import { ErdEngine } from "../src/utils/erd/erdEngine";
import { blogDocument, entity, field } from "./erdFixtures";

function blogEngine() {
  return new ErdEngine({
    initialDocument: { ...blogDocument(), viewport: { x: 5, y: 6, zoom: 0.8 } },
  });
}

function edited() {
  const doc = blogDocument();
  return {
    ...doc,
    engine: "mysql" as const,
    entities: [
      ...doc.entities.filter((e) => e.id !== "tags"),
      entity("extra", [field("extra_id")]),
    ],
    relationships: doc.relationships.filter((r) => r.targetEntityId !== "tags"),
    meta: { name: "Blog v2", custom: 1 },
  };
}

describe("ErdEngine.applyDocument", () => {
  it("replaces the content as one undo step and keeps the viewport", () => {
    const engine = blogEngine();
    engine.addEntity({ name: "before" });
    engine.applyDocument(edited(), { recordHistory: true });
    const state = engine.getState();
    expect(state.entities.map((e) => e.id)).toEqual(["users", "posts", "extra"]);
    expect(state.engine).toBe("mysql");
    expect(state.name).toBe("Blog v2");
    expect(state.viewport).toEqual({ x: 5, y: 6, zoom: 0.8 });
    expect(engine.toJSON().meta).toEqual({ name: "Blog v2", custom: 1 });
    expect(state.canUndo).toBe(true);

    engine.undo();
    expect(engine.getState().entities.map((e) => e.name)).toContain("before");
    expect(engine.getState().engine).toBe("postgres");
    engine.redo();
    expect(engine.getState().entities.map((e) => e.id)).toEqual(["users", "posts", "extra"]);
    engine.undo();
    engine.undo();
    expect(engine.getState().entities).toHaveLength(3);
    expect(engine.getState().canUndo).toBe(false);
  });

  it("drops selected ids that no longer exist", () => {
    const engine = blogEngine();
    engine.setSelection({ entityIds: ["users", "tags"], relationshipIds: ["r2"] });
    engine.applyDocument(edited(), { recordHistory: true });
    const { selection } = engine.getState();
    expect([...selection.entityIds]).toEqual(["users"]);
    expect(selection.relationshipIds.size).toBe(0);
  });

  it("emits change and updates lookups", () => {
    const engine = blogEngine();
    const onChange = vi.fn();
    engine.on("change", onChange);
    engine.applyDocument(edited(), { recordHistory: true });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(engine.getEntity("extra")).toBeDefined();
    expect(engine.getEntity("tags")).toBeUndefined();
  });

  it("without recordHistory clears history but still keeps the viewport", () => {
    const engine = blogEngine();
    engine.addEntity();
    engine.applyDocument(edited());
    expect(engine.getState().canUndo).toBe(false);
    expect(engine.getState().viewport).toEqual({ x: 5, y: 6, zoom: 0.8 });
  });

  it("leaves loadDocument behaviour unchanged", () => {
    const engine = blogEngine();
    engine.addEntity();
    engine.loadDocument(edited());
    expect(engine.getState().canUndo).toBe(false);
    expect(engine.getState().viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });
});

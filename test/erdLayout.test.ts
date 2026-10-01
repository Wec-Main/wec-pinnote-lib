import { describe, expect, it } from "vitest";
import { GRID_GAP } from "../src/utils/erd/erdConstants";
import { layoutErd } from "../src/utils/erd/erdLayout";
import { entity, field, relationship } from "./erdFixtures";

const measure = () => ({ width: 100, height: 50 });
const make = (id: string) => entity(id, [field(`${id}_f`)]);
const link = (id: string, parent: string, child: string) => relationship(id, parent, child);

describe("grid layout", () => {
  it("arranges entities in a square-ish grid without overlap", () => {
    const entities = ["a", "b", "c", "d", "e"].map(make);
    const positions = layoutErd("grid", entities, [], measure);
    expect(Object.keys(positions)).toHaveLength(5);
    expect(positions.a).toEqual({ x: 0, y: 0 });
    expect(positions.b).toEqual({ x: 100 + GRID_GAP, y: 0 });
    expect(positions.d?.y).toBe(50 + GRID_GAP);
    expect(positions.d?.x).toBe(0);
  });

  it("returns nothing for an empty model", () => {
    expect(layoutErd("grid", [], [], measure)).toEqual({});
  });

  it("is deterministic", () => {
    const entities = ["a", "b", "c"].map(make);
    expect(layoutErd("grid", entities, [], measure)).toEqual(
      layoutErd("grid", entities, [], measure),
    );
  });
});

describe("layered layout", () => {
  it("places parents in earlier columns than their children", () => {
    const entities = ["a", "b", "c"].map(make);
    const positions = layoutErd(
      "layered",
      entities,
      [link("r1", "a", "b"), link("r2", "b", "c")],
      measure,
    );
    expect(positions.a?.x).toBeLessThan(positions.b?.x ?? 0);
    expect(positions.b?.x).toBeLessThan(positions.c?.x ?? 0);
  });

  it("uses the longest path to choose a layer", () => {
    const entities = ["a", "b", "c"].map(make);
    const positions = layoutErd(
      "layered",
      entities,
      [link("r1", "a", "b"), link("r2", "b", "c"), link("r3", "a", "c")],
      measure,
    );
    expect(positions.c?.x).toBeGreaterThan(positions.b?.x ?? 0);
  });

  it("stacks siblings within one column", () => {
    const entities = ["a", "b", "c"].map(make);
    const positions = layoutErd(
      "layered",
      entities,
      [link("r1", "a", "b"), link("r2", "a", "c")],
      measure,
    );
    expect(positions.b?.x).toBe(positions.c?.x);
    expect(positions.b?.y).not.toBe(positions.c?.y);
  });

  it("terminates on cycles and still places every entity", () => {
    const entities = ["a", "b", "c"].map(make);
    const positions = layoutErd(
      "layered",
      entities,
      [link("r1", "a", "b"), link("r2", "b", "c"), link("r3", "c", "a")],
      measure,
    );
    expect(Object.keys(positions).sort()).toEqual(["a", "b", "c"]);
    expect(positions.a?.x).toBeLessThan(positions.c?.x ?? 0);
  });

  it("ignores self and dangling relationships", () => {
    const entities = ["a", "b"].map(make);
    const positions = layoutErd(
      "layered",
      entities,
      [link("r1", "a", "a"), relationship("r2", "a", "gone")],
      measure,
    );
    expect(Object.keys(positions).sort()).toEqual(["a", "b"]);
  });

  it("places disconnected entities after the connected block", () => {
    const entities = ["a", "b", "lonely"].map(make);
    const positions = layoutErd("layered", entities, [link("r1", "a", "b")], measure);
    const connectedBottom = Math.max(positions.a?.y ?? 0, positions.b?.y ?? 0) + 50;
    expect(positions.lonely?.y).toBeGreaterThanOrEqual(connectedBottom);
  });

  it("orders children by the position of their parents", () => {
    const entities = ["p1", "p2", "c2", "c1"].map(make);
    const positions = layoutErd(
      "layered",
      entities,
      [link("r1", "p1", "c1"), link("r2", "p2", "c2")],
      measure,
    );
    expect(positions.c1?.y).toBeLessThan(positions.c2?.y ?? 0);
  });

  it("is deterministic", () => {
    const entities = ["a", "b", "c", "d"].map(make);
    const rels = [link("r1", "a", "b"), link("r2", "a", "c")];
    expect(layoutErd("layered", entities, rels, measure)).toEqual(
      layoutErd("layered", entities, rels, measure),
    );
  });
});

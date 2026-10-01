import { describe, expect, it } from "vitest";
import {
  ENTITY_DEFAULT_WIDTH,
  ENTITY_HEADER_HEIGHT,
  FIELD_ROW_HEIGHT,
  MARKER_LENGTH,
} from "../src/utils/erd/erdConstants";
import {
  entityAnchor,
  entityHeight,
  fieldAnchor,
  getEntityRect,
  getNoteRect,
} from "../src/utils/erd/erdGeometry";
import {
  chooseSides,
  crowFootGlyph,
  relationshipEndKinds,
  relationshipGeometry,
} from "../src/utils/erd/relationshipPath";
import { entity, field, relationship } from "./erdFixtures";

const people = entity("a", [field("a1"), field("a2"), field("a3")], {
  position: { x: 100, y: 50 },
});

describe("entity geometry", () => {
  it("grows with the number of fields and shrinks to the header when collapsed", () => {
    const expanded = entityHeight(people);
    expect(expanded).toBeGreaterThan(ENTITY_HEADER_HEIGHT + 3 * FIELD_ROW_HEIGHT - 1);
    expect(entityHeight({ ...people, collapsed: true })).toBe(ENTITY_HEADER_HEIGHT);
  });

  it("builds rectangles from position, width and height", () => {
    expect(getEntityRect(people)).toEqual({
      x: 100,
      y: 50,
      width: ENTITY_DEFAULT_WIDTH,
      height: entityHeight(people),
    });
    expect(getEntityRect({ ...people, width: 300 }).width).toBe(300);
    expect(
      getNoteRect({ id: "n", text: "", position: { x: 1, y: 2 }, width: 3, height: 4 }),
    ).toEqual({
      x: 1,
      y: 2,
      width: 3,
      height: 4,
    });
  });

  it("anchors a field at the vertical centre of its row on the requested side", () => {
    const left = fieldAnchor(people, "a2", "left");
    const right = fieldAnchor(people, "a2", "right");
    expect(left).toEqual({ x: 100, y: 50 + ENTITY_HEADER_HEIGHT + FIELD_ROW_HEIGHT * 1.5 });
    expect(right.x).toBe(100 + ENTITY_DEFAULT_WIDTH);
    expect(right.y).toBe(left.y);
  });

  it("anchors an entity at the vertical middle of its rect on the requested side", () => {
    const height = entityHeight(people);
    expect(entityAnchor(people, "left")).toEqual({ x: 100, y: 50 + height / 2 });
    expect(entityAnchor(people, "right")).toEqual({
      x: 100 + ENTITY_DEFAULT_WIDTH,
      y: 50 + height / 2,
    });
    expect(entityAnchor({ ...people, collapsed: true }, "left").y).toBe(
      50 + ENTITY_HEADER_HEIGHT / 2,
    );
  });

  it("anchors every field at the header when the entity is collapsed or the field is unknown", () => {
    const headerY = 50 + ENTITY_HEADER_HEIGHT / 2;
    expect(fieldAnchor({ ...people, collapsed: true }, "a3", "left").y).toBe(headerY);
    expect(fieldAnchor(people, "missing", "left").y).toBe(headerY);
  });
});

describe("relationship geometry", () => {
  const parent = entity("p", [field("pid")], { position: { x: 0, y: 0 } });
  const child = entity("c", [field("cid")], { position: { x: 600, y: 0 } });
  const lookup = new Map([parent, child].map((e) => [e.id, e]));

  it("connects the facing sides of separated entities", () => {
    expect(chooseSides(getEntityRect(parent), getEntityRect(child))).toEqual({
      sourceSide: "right",
      targetSide: "left",
    });
    expect(chooseSides(getEntityRect(child), getEntityRect(parent))).toEqual({
      sourceSide: "left",
      targetSide: "right",
    });
  });

  it("routes overlapping entities out of the same side", () => {
    expect(
      chooseSides({ x: 0, y: 0, width: 100, height: 50 }, { x: 50, y: 80, width: 100, height: 50 }),
    ).toEqual({
      sourceSide: "right",
      targetSide: "right",
    });
  });

  it("maps cardinality onto marker kinds", () => {
    expect(relationshipEndKinds("one-to-one")).toEqual({ source: "one", target: "one" });
    expect(relationshipEndKinds("one-to-many")).toEqual({ source: "one", target: "many" });
    expect(relationshipEndKinds("many-to-many")).toEqual({ source: "many", target: "many" });
  });

  it("produces a path that starts at the source anchor and ends at the target anchor", () => {
    const geometry = relationshipGeometry(relationship("r", "p", "c"), lookup);
    expect(geometry).not.toBeNull();
    expect(geometry?.sourceAnchor).toEqual(entityAnchor(parent, "right"));
    expect(geometry?.targetAnchor).toEqual(entityAnchor(child, "left"));
    expect(
      geometry?.path.startsWith(`M ${geometry?.sourceAnchor.x},${geometry?.sourceAnchor.y}`),
    ).toBe(true);
    expect(
      geometry?.path.endsWith(`L ${geometry?.targetAnchor.x},${geometry?.targetAnchor.y}`),
    ).toBe(true);
    expect(geometry?.targetKind).toBe("many");
  });

  it("returns null when an end of the relationship is missing", () => {
    expect(relationshipGeometry(relationship("r", "p", "gone"), lookup)).toBeNull();
    expect(relationshipGeometry(relationship("r", "gone", "c"), lookup)).toBeNull();
  });
});

describe("crowFootGlyph", () => {
  const anchor = { x: 0, y: 0 };

  it("draws three prongs for many and a bar for a mandatory end", () => {
    const glyph = crowFootGlyph(anchor, "right", "many", false);
    expect(glyph.match(/M /g)).toHaveLength(4);
    expect(glyph).not.toContain("A ");
  });

  it("adds a circle for an optional end", () => {
    expect(crowFootGlyph(anchor, "right", "one", true)).toContain("A ");
    expect(crowFootGlyph(anchor, "left", "many", true)).toContain("A ");
  });

  it("draws two bars for a mandatory one end", () => {
    expect(crowFootGlyph(anchor, "right", "one", false).match(/M /g)).toHaveLength(2);
  });

  it("extends outward from the entity edge only by the marker length", () => {
    const coordinates = [
      ...crowFootGlyph({ x: 100, y: 0 }, "right", "many", false).matchAll(/(-?\d+(?:\.\d+)?),/g),
    ].map((match) => Number(match[1]));
    expect(Math.min(...coordinates)).toBeGreaterThanOrEqual(100);
    expect(Math.max(...coordinates)).toBeLessThanOrEqual(100 + MARKER_LENGTH);
  });
});

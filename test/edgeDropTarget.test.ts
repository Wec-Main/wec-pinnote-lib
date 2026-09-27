import { describe, expect, it } from "vitest";
import {
  closestPointOnSegment,
  findEdgeDropTarget,
  type EdgeSegment,
} from "../src/utils/flowchart/edgeDropTarget";

const horizontal: EdgeSegment = {
  edgeId: "e1",
  source: { x: 0, y: 0 },
  target: { x: 100, y: 0 },
};

describe("closestPointOnSegment", () => {
  it("projects a point onto the middle of the segment", () => {
    const hit = closestPointOnSegment({ x: 50, y: 10 }, horizontal.source, horizontal.target);
    expect(hit.point).toEqual({ x: 50, y: 0 });
    expect(hit.distance).toBe(10);
  });

  it("clamps to the endpoints rather than extending the line", () => {
    const hit = closestPointOnSegment({ x: -40, y: 0 }, horizontal.source, horizontal.target);
    expect(hit.point).toEqual({ x: 0, y: 0 });
    expect(hit.distance).toBe(40);
  });

  it("handles a zero-length segment", () => {
    const hit = closestPointOnSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(hit.distance).toBe(5);
  });
});

describe("findEdgeDropTarget", () => {
  it("returns the edge when the point is within tolerance", () => {
    const hit = findEdgeDropTarget({ x: 50, y: 12 }, [horizontal], [], 24);
    expect(hit?.edgeId).toBe("e1");
    expect(hit?.point).toEqual({ x: 50, y: 0 });
  });

  it("returns null when the point is beyond tolerance", () => {
    expect(findEdgeDropTarget({ x: 50, y: 40 }, [horizontal], [], 24)).toBeNull();
  });

  it("prefers the nearest of several edges", () => {
    const far: EdgeSegment = { edgeId: "e2", source: { x: 0, y: 20 }, target: { x: 100, y: 20 } };
    const hit = findEdgeDropTarget({ x: 50, y: 16 }, [horizontal, far], [], 24);
    expect(hit?.edgeId).toBe("e2");
  });

  it("ignores edges when the point is over a node", () => {
    const overNode = findEdgeDropTarget(
      { x: 50, y: 5 },
      [horizontal],
      [{ x: 40, y: -10, width: 40, height: 40 }],
      24,
    );
    expect(overNode).toBeNull();
  });
});

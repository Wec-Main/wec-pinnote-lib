import { describe, it, expect } from "vitest";
import { toRFEdge, fromRFEdge } from "../src/components/WecFlow/vendor/utils/rfAdapters";
import type { FlowEdge } from "../src/components/WecFlow/vendor/types/flow.types";

function makeEdge(overrides: Partial<FlowEdge> = {}): FlowEdge {
  return { id: "e1", source: "n1", target: "n2", ...overrides };
}

describe("toRFEdge / fromRFEdge arrow and line style", () => {
  it("round-trips arrow: forward", () => {
    const edge = makeEdge({ arrow: "forward", lineStyle: "solid" });
    expect(fromRFEdge(toRFEdge(edge))).toEqual(edge);
  });

  it("round-trips arrow: both", () => {
    const edge = makeEdge({ arrow: "both", lineStyle: "solid" });
    expect(fromRFEdge(toRFEdge(edge))).toEqual(edge);
  });

  it("round-trips arrow: none", () => {
    const edge = makeEdge({ arrow: "none", lineStyle: "solid" });
    expect(fromRFEdge(toRFEdge(edge))).toEqual(edge);
  });

  it("round-trips lineStyle: dashed", () => {
    const edge = makeEdge({ arrow: "forward", lineStyle: "dashed" });
    expect(fromRFEdge(toRFEdge(edge))).toEqual(edge);
  });

  it("defaults an edge with no arrow/lineStyle to forward/solid on the way back", () => {
    const edge = makeEdge();
    const rf = toRFEdge(edge);
    expect(fromRFEdge(rf)).toEqual(makeEdge({ arrow: "forward", lineStyle: "solid" }));
  });

  it("sets markerEnd only for a forward arrow", () => {
    const rf = toRFEdge(makeEdge({ arrow: "forward" }));
    expect(rf.markerStart).toBeUndefined();
    expect(rf.markerEnd).toBeDefined();
  });

  it("sets both markerStart and markerEnd for a two-way arrow", () => {
    const rf = toRFEdge(makeEdge({ arrow: "both" }));
    expect(rf.markerStart).toBeDefined();
    expect(rf.markerEnd).toBeDefined();
  });

  it("sets neither marker for arrow: none", () => {
    const rf = toRFEdge(makeEdge({ arrow: "none" }));
    expect(rf.markerStart).toBeUndefined();
    expect(rf.markerEnd).toBeUndefined();
  });

  it("sets strokeDasharray only for a dashed line style", () => {
    const solid = toRFEdge(makeEdge({ lineStyle: "solid" }));
    const dashed = toRFEdge(makeEdge({ lineStyle: "dashed" }));
    expect(solid.style?.strokeDasharray).toBeUndefined();
    expect(dashed.style?.strokeDasharray).toBeDefined();
  });
});

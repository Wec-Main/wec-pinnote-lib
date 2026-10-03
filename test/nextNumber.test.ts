import { describe, expect, it } from "vitest";
import { nextNumber } from "../src/hooks/useAnnotations";
import type { Annotation } from "../src/types/annotation.types";

function annotation(number: number): Annotation {
  return {
    id: `a${number}`,
    projectId: "p1",
    pageKey: "/home",
    number,
    status: "open",
    anchor: {
      selector: "",
      elementIdentifier: "x",
      relativeX: 0,
      relativeY: 0,
      fallbackX: 0,
      fallbackY: 0,
      viewportWidth: 0,
      viewportHeight: 0,
    },
    comments: [],
    createdBy: { id: "u1", name: "Ada" },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("nextNumber", () => {
  it("returns 1 for an empty list", () => {
    expect(nextNumber([])).toBe(1);
  });

  it("returns one past the highest existing number, regardless of order", () => {
    expect(nextNumber([annotation(1), annotation(5), annotation(3)])).toBe(6);
  });

  it("is exported for reuse (e.g. by AnnotationProvider's startDraft)", () => {
    expect(typeof nextNumber).toBe("function");
  });
});

import { describe, expect, it } from "vitest";
import { rangeForPreset, validateCustomRange } from "../src/utils/analyticsRange";

describe("rangeForPreset", () => {
  it("resolves a 7-day preset relative to now", () => {
    expect(rangeForPreset("7d", new Date("2026-09-24T10:00:00Z"))).toEqual({
      from: "2026-09-18",
      to: "2026-09-24",
    });
  });

  it("resolves a 30-day preset relative to now", () => {
    expect(rangeForPreset("30d", new Date("2026-09-24T10:00:00Z"))).toEqual({
      from: "2026-08-26",
      to: "2026-09-24",
    });
  });

  it("resolves a 90-day preset relative to now", () => {
    expect(rangeForPreset("90d", new Date("2026-09-24T10:00:00Z"))).toEqual({
      from: "2026-06-27",
      to: "2026-09-24",
    });
  });
});

describe("validateCustomRange", () => {
  it("accepts a valid ordered range", () => {
    expect(validateCustomRange("2026-09-01", "2026-09-24")).toBe(true);
  });

  it("rejects a reversed range", () => {
    expect(validateCustomRange("2026-09-24", "2026-09-01")).toBe(false);
  });

  it("rejects a range spanning more than 366 days", () => {
    expect(validateCustomRange("2025-01-01", "2026-01-02")).toBe(false);
  });

  it("accepts a range spanning exactly 366 days", () => {
    expect(validateCustomRange("2025-01-01", "2026-01-01")).toBe(true);
  });
});

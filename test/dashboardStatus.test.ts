import { describe, expect, it } from "vitest";
import {
  ALL_DASHBOARD_SECTIONS,
  bumpSections,
  deriveDashboardStatus,
  hasTrendActivity,
  initialSectionReloads,
  widgetView,
} from "../src/components/Settings/Dashboard/dashboardStatus";
import type { TrendDay } from "../src/types/analytics.types";

function day(overrides: Partial<TrendDay> = {}): TrendDay {
  return { day: "2026-09-01", visits: 0, logins: 0, comments: 0, ...overrides };
}

describe("deriveDashboardStatus", () => {
  it.each([
    { summaryLoaded: false, error: { status: 503, message: "x" }, expected: "unavailable" },
    { summaryLoaded: false, error: { status: 500, message: "x" }, expected: "error" },
    { summaryLoaded: false, error: { status: null, message: "x" }, expected: "error" },
    { summaryLoaded: true, error: { status: 503, message: "x" }, expected: "unavailable" },
    { summaryLoaded: true, error: null, expected: "ready" },
    { summaryLoaded: false, error: null, expected: "loading" },
  ])("maps loaded=$summaryLoaded error=$error.status to $expected", ({ summaryLoaded, error, expected }) => {
    expect(deriveDashboardStatus({ summaryLoaded, error })).toBe(expected);
  });
});

describe("widgetView", () => {
  it.each([
    { loading: true, loaded: false, error: null, isEmpty: false, expected: "loading" },
    { loading: false, loaded: true, error: "boom", isEmpty: false, expected: "error" },
    { loading: false, loaded: true, error: null, isEmpty: true, expected: "empty" },
    { loading: false, loaded: true, error: null, isEmpty: false, expected: "ready" },
    { loading: false, loaded: false, error: null, isEmpty: false, expected: "loading" },
  ])("gives $expected", ({ expected, ...input }) => {
    expect(widgetView(input)).toBe(expected);
  });
});

describe("hasTrendActivity", () => {
  it("is false for no days", () => {
    expect(hasTrendActivity([])).toBe(false);
  });

  it("is false when every day is zero", () => {
    expect(hasTrendActivity([day(), day({ day: "2026-09-02" })])).toBe(false);
  });

  it("is true when one day has a login", () => {
    expect(hasTrendActivity([day(), day({ day: "2026-09-02", logins: 1 })])).toBe(true);
  });
});

describe("bumpSections", () => {
  it("raises every counter by one for all sections", () => {
    expect(bumpSections(initialSectionReloads(), ALL_DASHBOARD_SECTIONS)).toEqual({
      summary: 1,
      pages: 1,
      trends: 1,
      topPages: 1,
      topUsers: 1,
      visitLog: 1,
    });
  });

  it("changes only the named section and leaves the input intact", () => {
    const reloads = initialSectionReloads();
    const next = bumpSections(reloads, ["summary"]);
    expect(next).toEqual({ ...reloads, summary: 1 });
    expect(reloads.summary).toBe(0);
  });

  it("returns the same reference for no sections", () => {
    const reloads = initialSectionReloads();
    expect(bumpSections(reloads, [])).toBe(reloads);
  });
});

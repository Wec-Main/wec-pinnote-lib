import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DashboardStatusGate } from "../src/components/Settings/Dashboard/DashboardStatusGate";
import { KpiCards } from "../src/components/Settings/Dashboard/KpiCards";
import type {
  DashboardError,
  DashboardStatus,
} from "../src/components/Settings/Dashboard/dashboardStatus";
import type { AnalyticsSummary } from "../src/types/analytics.types";

const summaryFixture: AnalyticsSummary = {
  range: { from: "2026-09-01", to: "2026-09-07" },
  users: { total: 42 },
  activeNow: 3,
  activeUsers: { dau: 5, wau: 9, mau: 17 },
  logins: { total: 20, unique: 11, failed: 2 },
  comments: { total: 8 },
  annotations: {
    total: 6,
    byStatus: { open: 1, "re-open": 1, "dev-inprogress": 2, completed: 1, closed: 1 },
  },
  visits: { total: 100 },
};

function occurrences(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

function renderGate(status: DashboardStatus, error: DashboardError | null = null): string {
  return renderToString(
    createElement(
      DashboardStatusGate,
      { status, error, onRetry: () => undefined },
      createElement("div", { className: "gate-child" }),
    ),
  );
}

describe("DashboardStatusGate", () => {
  it("renders one not-configured notice and no children when analytics is unavailable", () => {
    const html = renderGate("unavailable", { status: 503, message: "Service Unavailable" });

    expect(occurrences(html, "wpn-users-notice")).toBe(1);
    expect(occurrences(html, "wpn-skeleton")).toBe(0);
    expect(occurrences(html, "wpn-dashboard-kpi")).toBe(0);
    expect(occurrences(html, "gate-child")).toBe(0);
    expect(html).toContain("Analytics tables are not set up");
    expect(html).toContain("Retry");
  });

  it("renders one notice with the error message and no children on error", () => {
    const html = renderGate("error", { status: 500, message: "boom" });

    expect(occurrences(html, "wpn-users-notice")).toBe(1);
    expect(occurrences(html, "wpn-skeleton")).toBe(0);
    expect(occurrences(html, "wpn-dashboard-kpi")).toBe(0);
    expect(occurrences(html, "gate-child")).toBe(0);
    expect(html).toContain("boom");
    expect(html).toContain("Retry");
  });

  it("renders skeleton placeholders and no children while loading", () => {
    const html = renderGate("loading");

    expect(occurrences(html, "gate-child")).toBe(0);
    expect(occurrences(html, "wpn-users-notice")).toBe(0);
    expect(occurrences(html, "wpn-dashboard-placeholder--chart")).toBe(1);
    expect(occurrences(html, "wpn-dashboard-placeholder--table")).toBe(2);
  });

  it("renders its children and no notice when ready", () => {
    const html = renderGate("ready");

    expect(occurrences(html, "gate-child")).toBe(1);
    expect(occurrences(html, "wpn-users-notice")).toBe(0);
  });
});

describe("KpiCards", () => {
  it("renders skeletons only in the loading state", () => {
    const html = renderToString(createElement(KpiCards, { state: { kind: "loading" } }));

    expect(occurrences(html, "wpn-dashboard-kpi__skeleton")).toBe(6);
    expect(occurrences(html, "wpn-dashboard-status__skeleton")).toBe(5);
    expect(html).toContain('aria-busy="true"');
  });

  it("renders values and no skeletons in the ready state", () => {
    const html = renderToString(
      createElement(KpiCards, {
        state: { kind: "ready", summary: summaryFixture, refreshing: false },
      }),
    );

    expect(occurrences(html, "wpn-skeleton")).toBe(0);
    expect(html).toContain(">42<");
    expect(html).toContain('aria-busy="false"');
  });

  it("marks the cards busy while a ready summary refreshes", () => {
    const html = renderToString(
      createElement(KpiCards, {
        state: { kind: "ready", summary: summaryFixture, refreshing: true },
      }),
    );

    expect(occurrences(html, "wpn-skeleton")).toBe(0);
    expect(html).toContain('aria-busy="true"');
  });
});

describe("DashboardTab gating", () => {
  it("mounts every widget only inside the status gate", () => {
    const source = readFileSync("src/components/Settings/Dashboard/DashboardTab.tsx", "utf8");
    const gateOpen = source.indexOf("<DashboardStatusGate");
    const gateClose = source.indexOf("</DashboardStatusGate>");

    expect(gateOpen).toBeGreaterThan(-1);
    expect(gateClose).toBeGreaterThan(gateOpen);
    for (const widget of [
      "<KpiCards",
      "<PageVisitsTable",
      "<TrendsChart",
      "<TopPagesTable",
      "<TopUsersTable",
      "<VisitLogTable",
    ]) {
      expect(occurrences(source, widget)).toBe(1);
      const position = source.indexOf(widget);
      expect(position).toBeGreaterThan(gateOpen);
      expect(position).toBeLessThan(gateClose);
    }
  });
});

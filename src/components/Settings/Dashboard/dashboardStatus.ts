import type { TrendDay } from "../../../types/analytics.types";

export type DashboardStatus = "loading" | "unavailable" | "error" | "ready";

export interface DashboardError {
  status: number | null;
  message: string;
}

const ANALYTICS_UNAVAILABLE_STATUS = 503;

export function deriveDashboardStatus({
  summaryLoaded,
  error,
}: {
  summaryLoaded: boolean;
  error: DashboardError | null;
}): DashboardStatus {
  if (error) {
    return error.status === ANALYTICS_UNAVAILABLE_STATUS ? "unavailable" : "error";
  }
  return summaryLoaded ? "ready" : "loading";
}

export type WidgetView = "loading" | "error" | "empty" | "ready";

export function widgetView({
  loaded,
  error,
  isEmpty,
}: {
  loading: boolean;
  loaded: boolean;
  error: string | null;
  isEmpty: boolean;
}): WidgetView {
  if (error) {
    return "error";
  }
  if (!loaded) {
    return "loading";
  }
  return isEmpty ? "empty" : "ready";
}

export function hasTrendActivity(days: readonly TrendDay[]): boolean {
  return days.some((day) => day.visits > 0 || day.logins > 0 || day.comments > 0);
}

export type DashboardSection =
  "summary" | "pages" | "trends" | "topPages" | "topUsers" | "visitLog";

export const ALL_DASHBOARD_SECTIONS: readonly DashboardSection[] = [
  "summary",
  "pages",
  "trends",
  "topPages",
  "topUsers",
  "visitLog",
];

export type SectionReloads = Readonly<Record<DashboardSection, number>>;

export function initialSectionReloads(): SectionReloads {
  return { summary: 0, pages: 0, trends: 0, topPages: 0, topUsers: 0, visitLog: 0 };
}

export function bumpSections(
  reloads: SectionReloads,
  sections: readonly DashboardSection[],
): SectionReloads {
  if (sections.length === 0) {
    return reloads;
  }
  const next: Record<DashboardSection, number> = { ...reloads };
  for (const section of new Set(sections)) {
    next[section] += 1;
  }
  return next;
}

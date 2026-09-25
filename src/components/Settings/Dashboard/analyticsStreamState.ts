import { ALL_DASHBOARD_SECTIONS, type DashboardSection } from "./dashboardStatus";

export type AnalyticsChangeKind = "visits" | "presence" | "logins";

export type AnalyticsStreamState = "connecting" | "live" | "reconnecting" | "offline";

const ANALYTICS_CHANGE_KINDS: readonly string[] = ["visits", "presence", "logins"];

const SECTIONS_BY_KIND: Record<AnalyticsChangeKind, readonly DashboardSection[]> = {
  visits: ALL_DASHBOARD_SECTIONS,
  presence: ["summary"],
  logins: ["summary", "trends"],
};

function isAnalyticsChangeKind(value: unknown): value is AnalyticsChangeKind {
  return typeof value === "string" && ANALYTICS_CHANGE_KINDS.includes(value);
}

export function parseAnalyticsChange(data: string): AnalyticsChangeKind[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const kinds: unknown = (parsed as { kinds?: unknown }).kinds;
  if (!Array.isArray(kinds) || kinds.length === 0) {
    return null;
  }
  const valid = kinds.filter(isAnalyticsChangeKind);
  return valid.length === kinds.length ? valid : null;
}

export function sectionsForKinds(kinds: readonly AnalyticsChangeKind[]): DashboardSection[] {
  const wanted = new Set(kinds.flatMap((kind) => SECTIONS_BY_KIND[kind]));
  return ALL_DASHBOARD_SECTIONS.filter((section) => wanted.has(section));
}

export const INITIAL_RECONNECT_DELAY_MS = 2000;

const MAX_RECONNECT_DELAY_MS = 30000;

export function nextReconnectDelay(delay: number): number {
  return Math.min(delay * 2, MAX_RECONNECT_DELAY_MS);
}

const TERMINAL_FAILURE_STATUSES: readonly number[] = [401, 403, 503];

export function streamStateAfterFailure(status: number | undefined): AnalyticsStreamState {
  return status !== undefined && TERMINAL_FAILURE_STATUSES.includes(status)
    ? "offline"
    : "reconnecting";
}

export interface LiveIndicator {
  label: string;
  tone: "live" | "pending" | "off";
}

const LIVE_INDICATORS: Record<AnalyticsStreamState, LiveIndicator> = {
  connecting: { label: "Connecting", tone: "pending" },
  live: { label: "Live", tone: "live" },
  reconnecting: { label: "Reconnecting", tone: "pending" },
  offline: { label: "Live updates off", tone: "off" },
};

export function liveIndicator(state: AnalyticsStreamState): LiveIndicator {
  return LIVE_INDICATORS[state];
}

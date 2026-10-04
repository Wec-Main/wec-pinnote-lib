export type AnalyticsChangeKind = "visits" | "logins";

export type AnalyticsStreamState = "connecting" | "live" | "reconnecting" | "paused" | "offline";

const ANALYTICS_CHANGE_KINDS: readonly string[] = ["visits", "logins"];

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
  if (!Array.isArray(kinds)) {
    return null;
  }
  const valid = kinds.filter(isAnalyticsChangeKind);
  return valid.length > 0 ? valid : null;
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

export const LIVE_RELOAD_THROTTLE_MS = 30000;

export const RESYNC_JITTER_MS = 5000;

export interface ReloadScheduler {
  change(): void;
  resync(): void;
  reloadNow(): void;
  cancel(): void;
}

export interface ReloadSchedulerOptions {
  reload: () => void;
  throttleMs?: number;
  jitterMs?: number;
  now?: () => number;
  random?: () => number;
}

export function createReloadScheduler({
  reload,
  throttleMs = LIVE_RELOAD_THROTTLE_MS,
  jitterMs = RESYNC_JITTER_MS,
  now = Date.now,
  random = Math.random,
}: ReloadSchedulerOptions): ReloadScheduler {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastReloadAtMs = Number.NEGATIVE_INFINITY;

  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const reloadNow = () => {
    cancel();
    lastReloadAtMs = now();
    reload();
  };

  const schedule = (delayMs: number) => {
    timer = setTimeout(() => {
      timer = null;
      lastReloadAtMs = now();
      reload();
    }, delayMs);
  };

  return {
    change() {
      if (timer) {
        return;
      }
      schedule(Math.max(0, lastReloadAtMs + throttleMs - now()));
    },
    resync() {
      if (timer) {
        return;
      }
      schedule(Math.floor(random() * jitterMs));
    },
    reloadNow,
    cancel,
  };
}

export interface LiveIndicator {
  label: string;
  tone: "live" | "pending" | "off";
}

const LIVE_INDICATORS: Record<AnalyticsStreamState, LiveIndicator> = {
  connecting: { label: "Connecting", tone: "pending" },
  live: { label: "Live", tone: "live" },
  reconnecting: { label: "Reconnecting", tone: "pending" },
  paused: { label: "Paused", tone: "off" },
  offline: { label: "Live updates off", tone: "off" },
};

export function liveIndicator(state: AnalyticsStreamState): LiveIndicator {
  return LIVE_INDICATORS[state];
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INITIAL_RECONNECT_DELAY_MS,
  LIVE_RELOAD_THROTTLE_MS,
  createReloadScheduler,
  liveIndicator,
  nextReconnectDelay,
  parseAnalyticsChange,
  streamStateAfterFailure,
} from "../src/components/Settings/Dashboard/analyticsStreamState";

describe("createReloadScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(random = 0.5) {
    const reload = vi.fn();
    const scheduler = createReloadScheduler({ reload, random: () => random });
    return { reload, scheduler };
  }

  it("reloads on the first change and throttles the rest to one trailing reload", () => {
    const { reload, scheduler } = setup();

    scheduler.change();
    vi.advanceTimersByTime(0);
    expect(reload).toHaveBeenCalledTimes(1);

    scheduler.change();
    scheduler.change();
    vi.advanceTimersByTime(LIVE_RELOAD_THROTTLE_MS - 1);
    expect(reload).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("reloads after a jitter of at most five seconds on resync", () => {
    const { reload, scheduler } = setup(0.999);

    scheduler.resync();
    vi.advanceTimersByTime(4990);
    expect(reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("drops pending reloads on cancel", () => {
    const { reload, scheduler } = setup();

    scheduler.change();
    scheduler.cancel();
    vi.advanceTimersByTime(LIVE_RELOAD_THROTTLE_MS * 2);
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads immediately and restarts the throttle window on reloadNow", () => {
    const { reload, scheduler } = setup();

    scheduler.reloadNow();
    expect(reload).toHaveBeenCalledTimes(1);
    scheduler.change();
    vi.advanceTimersByTime(LIVE_RELOAD_THROTTLE_MS - 1);
    expect(reload).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});

describe("parseAnalyticsChange", () => {
  it.each([
    "not json",
    "{}",
    '{"kinds":[]}',
    '{"kinds":["comments"]}',
    '{"kinds":["presence"]}',
    "null",
  ])("rejects %s", (data) => {
    expect(parseAnalyticsChange(data)).toBeNull();
  });

  it("returns the kinds of a valid change", () => {
    expect(parseAnalyticsChange('{"kinds":["visits","logins"]}')).toEqual(["visits", "logins"]);
  });

  it("ignores kinds it does not know", () => {
    expect(parseAnalyticsChange('{"kinds":["visits","presence"]}')).toEqual(["visits"]);
  });
});

describe("nextReconnectDelay", () => {
  it("starts at two seconds and doubles", () => {
    expect(INITIAL_RECONNECT_DELAY_MS).toBe(2000);
    expect(nextReconnectDelay(2000)).toBe(4000);
  });

  it("caps at thirty seconds", () => {
    expect(nextReconnectDelay(20000)).toBe(30000);
  });
});

describe("streamStateAfterFailure", () => {
  it.each([401, 403, 503])("goes offline for %s", (status) => {
    expect(streamStateAfterFailure(status)).toBe("offline");
  });

  it.each([500, undefined])("reconnects for %s", (status) => {
    expect(streamStateAfterFailure(status)).toBe("reconnecting");
  });
});

describe("liveIndicator", () => {
  it("labels each state", () => {
    expect(liveIndicator("connecting")).toEqual({ label: "Connecting", tone: "pending" });
    expect(liveIndicator("live")).toEqual({ label: "Live", tone: "live" });
    expect(liveIndicator("reconnecting")).toEqual({ label: "Reconnecting", tone: "pending" });
    expect(liveIndicator("paused")).toEqual({ label: "Paused", tone: "off" });
    expect(liveIndicator("offline")).toEqual({ label: "Live updates off", tone: "off" });
  });
});

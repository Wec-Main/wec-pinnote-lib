import { describe, expect, it } from "vitest";
import {
  INITIAL_RECONNECT_DELAY_MS,
  liveIndicator,
  nextReconnectDelay,
  parseAnalyticsChange,
  sectionsForKinds,
  streamStateAfterFailure,
} from "../src/components/Settings/Dashboard/analyticsStreamState";
import { ALL_DASHBOARD_SECTIONS } from "../src/components/Settings/Dashboard/dashboardStatus";

describe("sectionsForKinds", () => {
  it("maps presence to the summary", () => {
    expect(sectionsForKinds(["presence"])).toEqual(["summary"]);
  });

  it("maps logins to the summary and trends", () => {
    expect(sectionsForKinds(["logins"])).toEqual(["summary", "trends"]);
  });

  it("maps visits to every section", () => {
    expect(sectionsForKinds(["visits"])).toEqual([...ALL_DASHBOARD_SECTIONS]);
  });

  it("deduplicates in section order", () => {
    expect(sectionsForKinds(["logins", "presence"])).toEqual(["summary", "trends"]);
  });
});

describe("parseAnalyticsChange", () => {
  it.each(["not json", "{}", '{"kinds":[]}', '{"kinds":["comments"]}', "null"])(
    "rejects %s",
    (data) => {
      expect(parseAnalyticsChange(data)).toBeNull();
    },
  );

  it("returns the kinds of a valid change", () => {
    expect(parseAnalyticsChange('{"kinds":["visits","logins"]}')).toEqual(["visits", "logins"]);
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
    expect(liveIndicator("offline")).toEqual({ label: "Live updates off", tone: "off" });
  });
});

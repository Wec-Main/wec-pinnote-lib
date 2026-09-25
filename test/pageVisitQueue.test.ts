import { describe, expect, it } from "vitest";
import {
  enqueueBounded,
  finalizeVisit,
  isContinuation,
  isTrackingEnabled,
  pathOnly,
  referrerOrigin,
  scrollDepthPercent,
  takeBatch,
} from "../src/utils/pageVisitQueue";
import type { OpenPageView, PageVisitRecord } from "../src/types/pageVisit.types";

function openView(overrides: Partial<OpenPageView> = {}): OpenPageView {
  return {
    pageKey: "/board",
    urlPath: "/board",
    referrer: null,
    enteredAtMs: 1000,
    clientVisitId: "visit-00000001",
    sessionId: "session-00000001",
    maxScrollDepth: 0,
    viewportWidth: 1280,
    viewportHeight: 800,
    language: "en-US",
    timezone: "UTC",
    continuation: false,
    ...overrides,
  };
}

function visit(overrides: Partial<PageVisitRecord> = {}): PageVisitRecord {
  return {
    clientVisitId: "visit-00000001",
    sessionId: "session-00000001",
    pageKey: "/board",
    urlPath: "/board",
    title: null,
    referrer: null,
    enteredAt: "2026-01-01T00:00:00.000Z",
    durationMs: 1000,
    maxScrollDepth: 0,
    viewportWidth: 1280,
    viewportHeight: 800,
    language: "en-US",
    timezone: "UTC",
    continuation: false,
    ...overrides,
  };
}

describe("isTrackingEnabled", () => {
  it("is false when the config flag is explicitly off", () => {
    expect(isTrackingEnabled(false, true)).toBe(false);
  });

  it("is false when the user is signed out", () => {
    expect(isTrackingEnabled(undefined, false)).toBe(false);
  });

  it("is true when signed in and the flag is unset", () => {
    expect(isTrackingEnabled(undefined, true)).toBe(true);
  });
});

describe("isContinuation", () => {
  it("is true at 4999 ms on the same page key", () => {
    expect(isContinuation({ pageKey: "/board", leftAtMs: 1000 }, "/board", 5999, false)).toBe(
      true,
    );
  });

  it("is false at 5001 ms on the same page key", () => {
    expect(isContinuation({ pageKey: "/board", leftAtMs: 1000 }, "/board", 6001, false)).toBe(
      false,
    );
  });

  it("is false for a different page key", () => {
    expect(isContinuation({ pageKey: "/board", leftAtMs: 1000 }, "/other", 2000, false)).toBe(
      false,
    );
  });

  it("is true when resumed after the tab was hidden", () => {
    expect(isContinuation(undefined, "/board", 2000, true)).toBe(true);
  });

  it("is false with no previous view and no resume", () => {
    expect(isContinuation(undefined, "/board", 2000, false)).toBe(false);
  });
});

describe("scrollDepthPercent", () => {
  it("clamps to 100 when the document fits the viewport", () => {
    expect(scrollDepthPercent(0, 800, 800)).toBe(100);
    expect(scrollDepthPercent(0, 800, 600)).toBe(100);
  });

  it("clamps to the 0..100 range", () => {
    expect(scrollDepthPercent(-50, 800, 2000)).toBe(0);
    expect(scrollDepthPercent(100000, 800, 2000)).toBe(100);
  });

  it("computes an in-range percentage", () => {
    expect(scrollDepthPercent(600, 800, 2000)).toBe(50);
  });
});

describe("finalizeVisit", () => {
  it("computes durationMs from the entered and left timestamps", () => {
    const result = finalizeVisit(openView({ enteredAtMs: 1000 }), 4000, "Board");
    expect(result.durationMs).toBe(3000);
    expect(result.title).toBe("Board");
  });

  it("clamps a negative duration to zero", () => {
    const result = finalizeVisit(openView({ enteredAtMs: 5000 }), 1000, null);
    expect(result.durationMs).toBe(0);
  });

  it("clamps scroll depth into the schema range", () => {
    const result = finalizeVisit(openView({ maxScrollDepth: 150 }), 2000, null);
    expect(result.maxScrollDepth).toBe(100);
  });
});

describe("pathOnly", () => {
  it("strips the query string and hash", () => {
    expect(pathOnly("/a?t=secret#x")).toBe("/a");
  });

  it("leaves a plain path unchanged", () => {
    expect(pathOnly("/a/b")).toBe("/a/b");
  });
});

describe("referrerOrigin", () => {
  it("keeps the origin and pathname, dropping query and hash", () => {
    expect(referrerOrigin("https://example.com/a/b?x=1#y")).toBe("https://example.com/a/b");
  });

  it("falls back to a path-only string for an unparsable value", () => {
    expect(referrerOrigin("/a?x=1")).toBe("/a");
  });
});

describe("takeBatch", () => {
  it("caps a batch at 50 items", () => {
    const queue = Array.from({ length: 51 }, (_, i) => visit({ clientVisitId: `visit-${i}` }));
    const { batch, remaining } = takeBatch(queue, (visits) => JSON.stringify(visits).length);
    expect(batch).toHaveLength(50);
    expect(remaining).toHaveLength(1);
  });

  it("splits a batch before the byte cap", () => {
    const bigTitle = "x".repeat(2000);
    const queue = Array.from({ length: 40 }, (_, i) =>
      visit({ clientVisitId: `visit-${i}`, title: bigTitle }),
    );
    const { batch, remaining } = takeBatch(queue, (visits) => JSON.stringify(visits).length);
    expect(JSON.stringify(batch).length).toBeLessThanOrEqual(60000);
    expect(batch.length + remaining.length).toBe(40);
    expect(batch.length).toBeLessThan(40);
  });

  it("always includes at least one item even if it alone exceeds the byte cap", () => {
    const oversized = visit({ title: "x".repeat(70000) });
    const { batch, remaining } = takeBatch([oversized], (visits) => JSON.stringify(visits).length);
    expect(batch).toHaveLength(1);
    expect(remaining).toHaveLength(0);
  });
});

describe("enqueueBounded", () => {
  it("drops the oldest item past 200", () => {
    let queue: PageVisitRecord[] = Array.from({ length: 200 }, (_, i) =>
      visit({ clientVisitId: `visit-${i}` }),
    );
    queue = enqueueBounded(queue, visit({ clientVisitId: "visit-200" }));
    expect(queue).toHaveLength(200);
    expect(queue[0]?.clientVisitId).toBe("visit-1");
    expect(queue[queue.length - 1]?.clientVisitId).toBe("visit-200");
  });

  it("does not drop below the cap", () => {
    const queue = enqueueBounded([visit()], visit({ clientVisitId: "visit-2" }));
    expect(queue).toHaveLength(2);
  });
});

import { describe, expect, it } from "vitest";
import { niceTopTick, thinXLabels, trendChartGeometry, yAxisTicks } from "../src/utils/trendChart";

interface TrendDay {
  date: string;
  visits: number;
  logins: number;
}

function daysOf(count: number, valueFor: (index: number) => number): TrendDay[] {
  return Array.from({ length: count }, (_, index) => ({
    date: `2026-09-${String(index + 1).padStart(2, "0")}`,
    visits: valueFor(index),
    logins: 0,
  }));
}

const dimensions = { width: 600, height: 200, padding: 20 };

describe("niceTopTick", () => {
  it("rounds 37 up to 40", () => {
    expect(niceTopTick(37)).toBe(40);
  });

  it("returns at least 1 for a zero or negative max", () => {
    expect(niceTopTick(0)).toBe(1);
    expect(niceTopTick(-5)).toBe(1);
  });
});

describe("trendChartGeometry", () => {
  it("plots an all-zero series on the baseline with a top tick of 1", () => {
    const days = daysOf(5, () => 0);
    const geometry = trendChartGeometry(days, ["visits"], dimensions);

    expect(geometry.yMax).toBe(1);
    expect(geometry.yTicks[0]).toBe(0);
    expect(geometry.yTicks[geometry.yTicks.length - 1]).toBe(1);

    const coordinates = geometry.series.visits.coordinates;
    for (const point of coordinates) {
      expect(point.y).toBe(geometry.plotBottom);
    }
  });

  it("gives a top tick of 40 for a max value of 37", () => {
    const days = daysOf(3, (index) => [10, 37, 20][index]);
    const geometry = trendChartGeometry(days, ["visits"], dimensions);

    expect(geometry.yMax).toBe(40);
  });

  it("thins x labels to at most 8 for a 30-day range", () => {
    const days = daysOf(30, (index) => index);
    const geometry = trendChartGeometry(days, ["visits"], dimensions);

    expect(geometry.xLabels.length).toBeLessThanOrEqual(8);
    expect(geometry.xLabels[0].index).toBe(0);
    expect(geometry.xLabels[geometry.xLabels.length - 1].index).toBe(29);
  });

  it("keeps every label when the range is 8 days or fewer", () => {
    const days = daysOf(8, (index) => index);
    const geometry = trendChartGeometry(days, ["visits"], dimensions);

    expect(geometry.xLabels.length).toBe(8);
  });

  it("centres a single day", () => {
    const days = daysOf(1, () => 5);
    const geometry = trendChartGeometry(days, ["visits"], dimensions);

    expect(geometry.xLabels.length).toBe(1);
    const [point] = geometry.series.visits.coordinates;
    const expectedCenter = dimensions.padding + (dimensions.width - dimensions.padding * 2) / 2;
    expect(point.x).toBe(expectedCenter);
  });

  it("produces a points string with one coordinate pair per day, per series", () => {
    const days = daysOf(4, (index) => index * 2);
    const geometry = trendChartGeometry(days, ["visits", "logins"], dimensions);

    expect(geometry.series.visits.points.split(" ")).toHaveLength(4);
    expect(geometry.series.logins.points.split(" ")).toHaveLength(4);
  });
});

describe("thinXLabels", () => {
  it("returns every index when at or under the cap", () => {
    expect(thinXLabels(daysOf(8, () => 0))).toHaveLength(8);
  });

  it("always includes the last index when thinning", () => {
    const indices = thinXLabels(daysOf(30, () => 0));
    expect(indices[indices.length - 1]).toBe(29);
    expect(indices.length).toBeLessThanOrEqual(8);
  });
});

describe("yAxisTicks", () => {
  it("returns evenly spaced ticks up to the nice top value", () => {
    const ticks = yAxisTicks(37, 5);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBe(40);
    expect(ticks).toHaveLength(5);
  });
});

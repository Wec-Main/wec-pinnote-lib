import { describe, expect, it } from "vitest";
import { computeBackoffDelay, withJitter } from "../src/utils/backoff";

describe("withJitter", () => {
  it("stays between half and all of the nominal delay", () => {
    expect(withJitter(2000, () => 0)).toBe(1000);
    expect(withJitter(2000, () => 0.5)).toBe(1500);
    expect(withJitter(2000, () => 0.999999)).toBe(2000);
  });
});

describe("computeBackoffDelay", () => {
  it("doubles the delay for each attempt", () => {
    expect(computeBackoffDelay(0, { baseMs: 100, maxMs: 8000 })).toBe(100);
    expect(computeBackoffDelay(1, { baseMs: 100, maxMs: 8000 })).toBe(200);
    expect(computeBackoffDelay(2, { baseMs: 100, maxMs: 8000 })).toBe(400);
  });

  it("caps the delay at maxMs", () => {
    expect(computeBackoffDelay(10, { baseMs: 100, maxMs: 8000 })).toBe(8000);
  });
});

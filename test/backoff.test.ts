import { describe, expect, it } from "vitest";
import { withJitter } from "../src/utils/backoff";

describe("withJitter", () => {
  it("stays between half and all of the nominal delay", () => {
    expect(withJitter(2000, () => 0)).toBe(1000);
    expect(withJitter(2000, () => 0.5)).toBe(1500);
    expect(withJitter(2000, () => 0.999999)).toBe(2000);
  });
});

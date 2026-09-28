import { describe, expect, it } from "vitest";
import { resolveEffectiveProjectVersionId } from "../src/utils/resolveEffectiveProjectVersionId";

describe("resolveEffectiveProjectVersionId", () => {
  it("prefers the host override even when a live current version is known", () => {
    expect(resolveEffectiveProjectVersionId("v1", "v2")).toBe("v1");
  });

  it("falls back to the live current version when no host override is set", () => {
    expect(resolveEffectiveProjectVersionId(undefined, "v2")).toBe("v2");
  });

  it("returns undefined when neither is known yet", () => {
    expect(resolveEffectiveProjectVersionId(undefined, undefined)).toBeUndefined();
  });
});

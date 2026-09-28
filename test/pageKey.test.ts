import { describe, expect, it } from "vitest";
import { composeViewPageKey } from "../src/utils/pageKey";

describe("composeViewPageKey", () => {
  it("returns the base unchanged when there are no views", () => {
    expect(composeViewPageKey("/login", [])).toBe("/login");
  });

  it("suffixes with the last view", () => {
    expect(composeViewPageKey("/login", ["forgot_password"])).toBe("/login::forgot_password");
  });

  it("uses the innermost view when nested", () => {
    expect(composeViewPageKey("/login", ["forgot_password", "confirm"])).toBe("/login::confirm");
  });
});

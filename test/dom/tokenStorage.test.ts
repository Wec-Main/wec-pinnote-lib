import { afterEach, describe, expect, it } from "vitest";
import { tokenStorage } from "../../src/hooks/tokenStorage";
import type { StoredAuthRecord } from "../../src/hooks/tokenStorage";

const KEY = "wpn-auth:test-project";

afterEach(() => {
  window.localStorage.clear();
});

describe("tokenStorage", () => {
  it("returns null when nothing is stored", () => {
    expect(tokenStorage.read(KEY)).toBeNull();
  });

  it("round-trips a written record", () => {
    const record: StoredAuthRecord = {
      accounts: [
        {
          id: "u1",
          name: "Ada Lovelace",
          roleId: "contributor",
          token: "header.payload.signature",
          refreshToken: "header.payload2.signature",
        },
      ],
      activeId: "u1",
    };

    tokenStorage.write(KEY, record);
    expect(tokenStorage.read(KEY)).toEqual(record);
    // It is plain JSON in localStorage, by design — see the comment in
    // tokenStorage.ts for the tradeoff this seam exists to isolate.
    expect(window.localStorage.getItem(KEY)).toBe(JSON.stringify(record));
  });

  it("clears a stored record", () => {
    tokenStorage.write(KEY, { accounts: [], activeId: null });
    tokenStorage.clear(KEY);
    expect(tokenStorage.read(KEY)).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("returns null for corrupt JSON instead of throwing", () => {
    window.localStorage.setItem(KEY, "{not json");
    expect(() => tokenStorage.read(KEY)).not.toThrow();
    expect(tokenStorage.read(KEY)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { isSession, normalizeStoredAuth } from "../src/hooks/useAuthSessions";

const session = {
  id: "u1",
  name: "Ada Lovelace",
  email: "ada@wec.ai",
  roleId: "contributor" as const,
  token: "signed.jwt.token",
};

describe("isSession", () => {
  it("accepts a stored session carrying an identity and a role", () => {
    expect(isSession(session)).toBe(true);
  });

  it("rejects values that cannot identify a user", () => {
    expect(isSession({ ...session, id: "" })).toBe(false);
    expect(isSession({ name: "No id", roleId: "contributor" })).toBe(false);
    expect(isSession({ id: "u1", roleId: "contributor" })).toBe(false);
    expect(isSession({ id: "u1", name: "No role" })).toBe(false);
    expect(isSession(null)).toBe(false);
    expect(isSession("u1")).toBe(false);
    expect(isSession([])).toBe(false);
  });

  it("rejects a session with no signed bearer token", () => {
    // A pre-fix stored session (or a forged one) carries no server-issued
    // token; trusting it would send every request unauthenticated.
    expect(isSession({ id: "u1", name: "Ada Lovelace", roleId: "contributor" })).toBe(false);
    expect(isSession({ ...session, token: "" })).toBe(false);
  });
});

describe("normalizeStoredAuth", () => {
  it("restores a stored session", () => {
    const restored = normalizeStoredAuth({ accounts: [session], activeId: "u1" });

    expect(restored.accounts).toHaveLength(1);
    expect(restored.activeId).toBe("u1");
  });

  it("returns nothing for a payload whose accounts are not a list", () => {
    expect(normalizeStoredAuth({ accounts: "u1" } as never)).toEqual({
      accounts: [],
      activeId: null,
    });
    expect(normalizeStoredAuth(null)).toEqual({ accounts: [], activeId: null });
  });

  it("drops entries that are not shaped like a session", () => {
    const restored = normalizeStoredAuth({
      accounts: [session, { id: "" }, { name: "no id" }, null, "nope"] as never,
      activeId: "u1",
    });

    expect(restored.accounts).toHaveLength(1);
    expect(restored.accounts[0].id).toBe("u1");
  });

  it("never reports an active id that names no stored account", () => {
    // Otherwise the UI believes it is signed in while activeAccount resolves to
    // null, leaving the toolbar in a state no interaction can clear.
    expect(normalizeStoredAuth({ accounts: [session], activeId: "u-removed" }).activeId).toBe("u1");
  });

  it("clears the active id when every account was discarded", () => {
    expect(normalizeStoredAuth({ accounts: [{ id: "" }] as never, activeId: "u1" })).toEqual({
      accounts: [],
      activeId: null,
    });
  });

  it("falls back to the first account when no active id is stored", () => {
    expect(normalizeStoredAuth({ accounts: [session], activeId: null }).activeId).toBe("u1");
  });
});

import { describe, expect, it } from "vitest";
import { isSession, isTokenUnexpired, normalizeStoredAuth } from "../src/hooks/useAuthSessions";

function encodeSegment(payload: unknown): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function makeToken(payload: unknown): string {
  return `header.${encodeSegment(payload)}.signature`;
}

const validToken = makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
const expiredToken = makeToken({ exp: Math.floor(Date.now() / 1000) - 3600 });

const session = {
  id: "u1",
  name: "Ada Lovelace",
  email: "ada@wec.ai",
  roleId: "contributor" as const,
  token: validToken,
  refreshToken: makeToken({ sub: "u1", tokenVersion: 0, typ: "refresh" }),
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
    expect(isSession({ id: "u1", name: "Ada Lovelace", roleId: "contributor" })).toBe(false);
    expect(isSession({ ...session, token: "" })).toBe(false);
  });

  it("rejects a session whose token is not a well-formed JWT", () => {
    expect(isSession({ ...session, token: "not-a-jwt-at-all" })).toBe(false);
  });

  it("rejects a session whose token has expired", () => {
    expect(isSession({ ...session, token: expiredToken })).toBe(false);
  });

  it("rejects a session whose token payload is not valid base64url JSON", () => {
    expect(isSession({ ...session, token: "header.not-valid-base64url!!.signature" })).toBe(false);
  });
});

describe("isTokenUnexpired", () => {
  it("rejects a forged non-JWT token string", () => {
    expect(isTokenUnexpired("random-forged-string")).toBe(false);
  });

  it("rejects an expired token", () => {
    expect(isTokenUnexpired(expiredToken)).toBe(false);
  });

  it("rejects a token with a malformed payload segment", () => {
    expect(isTokenUnexpired("header.not-valid-base64url!!.signature")).toBe(false);
  });

  it("accepts a token with a future exp claim", () => {
    expect(isTokenUnexpired(validToken)).toBe(true);
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

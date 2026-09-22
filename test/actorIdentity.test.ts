import { describe, expect, it } from "vitest";
import { actorHeaders, actorToken } from "../src/services/actorIdentity";

const USER_ID = "11111111-1111-4111-8111-111111111111";

function decodeClaims(token: string): Record<string, unknown> {
  const payload = token.split(".")[1] ?? "";
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return JSON.parse(atob(padded)) as Record<string, unknown>;
}

describe("actorToken", () => {
  it("carries the user id in the sub claim the API reads", () => {
    // The API decodes `sub` to identify the caller; without it every write is
    // audited as "anonymous".
    expect(decodeClaims(actorToken(USER_ID)).sub).toBe(USER_ID);
  });

  it("produces three dot-separated segments so the API can split it", () => {
    expect(actorToken(USER_ID).split(".")).toHaveLength(3);
  });

  it("stays base64url-safe", () => {
    expect(actorToken(USER_ID)).not.toMatch(/[+/=]/);
  });
});

describe("actorHeaders", () => {
  it("sends a bearer token for a signed-in user", () => {
    expect(actorHeaders(USER_ID)).toEqual({
      Authorization: `Bearer ${actorToken(USER_ID)}`,
    });
  });

  it("sends nothing when no one is signed in", () => {
    expect(actorHeaders(undefined)).toEqual({});
  });
});

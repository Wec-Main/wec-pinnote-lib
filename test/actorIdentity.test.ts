import { describe, expect, it } from "vitest";
import { actorHeaders } from "../src/services/actorIdentity";

const TOKEN = "signed.jwt.token";

describe("actorHeaders", () => {
  it("sends the server-issued bearer token for a signed-in user", () => {
    expect(actorHeaders(TOKEN)).toEqual({
      Authorization: `Bearer ${TOKEN}`,
    });
  });

  it("sends nothing when no one is signed in", () => {
    expect(actorHeaders(undefined)).toEqual({});
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { resetUserPassword } from "../src/services/userManagementService";

const STALE_TOKEN = "stale.jwt.token";
const FRESH_TOKEN = "fresh.jwt.token";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resetUserPassword retry on 401", () => {
  it("retries once with a refreshed token and returns the result", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: "Unauthorized" }))
      .mockResolvedValueOnce(jsonResponse(200, { user: { id: "u1" }, password: "generated" }));
    vi.stubGlobal("fetch", fetchMock);

    const getAuthToken = vi
      .fn()
      .mockResolvedValueOnce(STALE_TOKEN)
      .mockResolvedValueOnce(FRESH_TOKEN);

    const result = await resetUserPassword(
      "https://api.example.com",
      getAuthToken,
      "project-1",
      "u1",
    );

    expect(result).toMatchObject({ password: "generated" });
    expect(getAuthToken).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: `Bearer ${STALE_TOKEN}`,
    });
    expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({
      Authorization: `Bearer ${FRESH_TOKEN}`,
    });
  });

  it("propagates the 401 when the retry also fails, matching a dead session", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: "Unauthorized" }))
      .mockResolvedValueOnce(jsonResponse(401, { error: "Unauthorized" }));
    vi.stubGlobal("fetch", fetchMock);

    const getAuthToken = vi.fn().mockResolvedValue(undefined);

    await expect(
      resetUserPassword("https://api.example.com", getAuthToken, "project-1", "u1"),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { createAnnotationApi } from "../src/services/annotationApi";

const STALE_TOKEN = "stale.jwt.token";
const FRESH_TOKEN = "fresh.jwt.token";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createAnnotationApi retry on 401", () => {
  it("retries once with a refreshed token and returns the result", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: "Unauthorized" }))
      .mockResolvedValueOnce(jsonResponse(200, { id: "a1" }));
    vi.stubGlobal("fetch", fetchMock);

    const getAuthToken = vi.fn().mockResolvedValueOnce(STALE_TOKEN).mockResolvedValueOnce(FRESH_TOKEN);
    const api = createAnnotationApi({ apiBaseUrl: "https://api.example.com", getAuthToken });

    const result = await api.getAnnotation("a1");

    expect(result).toMatchObject({ id: "a1" });
    expect(getAuthToken).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: `Bearer ${STALE_TOKEN}` });
    expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({ Authorization: `Bearer ${FRESH_TOKEN}` });
  });

  it("propagates the 401 when the retry also fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: "Unauthorized" }))
      .mockResolvedValueOnce(jsonResponse(401, { error: "Unauthorized" }));
    vi.stubGlobal("fetch", fetchMock);

    const getAuthToken = vi.fn().mockResolvedValue(undefined);
    const api = createAnnotationApi({ apiBaseUrl: "https://api.example.com", getAuthToken });

    await expect(api.getAnnotation("a1")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-401 failure", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(500, { error: "Server error" }));
    vi.stubGlobal("fetch", fetchMock);

    const getAuthToken = vi.fn().mockResolvedValue(STALE_TOKEN);
    const api = createAnnotationApi({ apiBaseUrl: "https://api.example.com", getAuthToken });

    await expect(api.getAnnotation("a1")).rejects.toMatchObject({ status: 500 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getAuthToken).toHaveBeenCalledTimes(1);
  });
});

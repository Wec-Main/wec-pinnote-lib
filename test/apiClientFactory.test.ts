import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "../src/services/apiClientFactory";
import { RequestTimeoutError } from "../src/utils/requestTimeout";
import { AnnotationApiError } from "../src/types/annotation.types";

const BASE = "https://api.example.com";
const PREFIX = `${BASE}/api/v1/pinnote`;

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, init };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("createApiClient", () => {
  it("builds the url, sends a bare GET and parses the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { id: "p1" }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createApiClient(BASE, "tok");
    const result = await client.call<{ id: string }>("/projects/p1", { query: { x: "y" } });

    expect(result).toEqual({ id: "p1" });
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe(`${PREFIX}/projects/p1?x=y`);
    expect(init.method).toBeUndefined();
    expect(init.headers).toMatchObject({ Authorization: "Bearer tok" });
  });

  it("serializes the body and sets the method for a mutation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { id: "p1" }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createApiClient(BASE, "tok");
    await client.call("/projects", { method: "POST", body: { name: "Shop" } });

    const { init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ name: "Shop" });
  });

  it("supports callNoContent and callBlob", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(new Blob(["x"]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createApiClient(BASE, "tok");
    await expect(
      client.callNoContent("/projects/p1", { method: "DELETE" }),
    ).resolves.toBeUndefined();
    const blob = await client.callBlob("/projects/p1/export");
    expect(blob).toBeInstanceOf(Blob);
  });

  it("retries once with a refreshed token when getAuthToken is a callback", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: "Unauthorized" }))
      .mockResolvedValueOnce(jsonResponse(200, { id: "p1" }));
    vi.stubGlobal("fetch", fetchMock);

    const getAuthToken = vi.fn().mockResolvedValueOnce("stale").mockResolvedValueOnce("fresh");
    const client = createApiClient(BASE, getAuthToken);
    const result = await client.call<{ id: string }>("/projects/p1");

    expect(result).toEqual({ id: "p1" });
    expect(getAuthToken).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: "Bearer stale" });
    expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({ Authorization: "Bearer fresh" });
  });

  it("surfaces a normalized error instead of crashing for a malformed api base url", async () => {
    const client = createApiClient("http://[::1", "tok");
    await expect(client.call("/projects")).rejects.toBeInstanceOf(AnnotationApiError);
  });

  describe("timeouts", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("times out a request that never settles using the default timeout", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(() => new Promise(() => {})),
      );
      const client = createApiClient(BASE, "tok");
      const pending = client.call("/projects/p1").catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(20_001);
      expect(await pending).toBeInstanceOf(RequestTimeoutError);
    });

    it("honors a custom timeoutMs option", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(() => new Promise(() => {})),
      );
      const client = createApiClient(BASE, "tok", { timeoutMs: 500 });
      const pending = client.call("/projects/p1").catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(501);
      expect(await pending).toBeInstanceOf(RequestTimeoutError);
    });
  });
});

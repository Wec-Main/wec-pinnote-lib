import { afterEach, describe, expect, it, vi } from "vitest";
import { request, requestConditional } from "../src/services/httpClient";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestConditional", () => {
  it("sends If-None-Match and reports 304 as unchanged", async () => {
    const fetchMock = vi.fn(
      async () => new Response(null, { status: 304, headers: { ETag: '"a"' } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await requestConditional<string[]>("/x", undefined, '"a"');
    expect(result.unchanged).toBe(true);
    expect(result.etag).toBe('"a"');
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)["If-None-Match"]).toBe('"a"');
  });

  it("returns parsed data with the response etag", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('["x"]', { status: 200, headers: { ETag: '"b"' } })),
    );
    const result = await requestConditional<string[]>("/x", undefined, null);
    expect(result.unchanged).toBe(false);
    expect(result.data).toEqual(["x"]);
    expect(result.etag).toBe('"b"');
  });

  it("leaves plain request treating 304 as an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 304 })),
    );
    await expect(request("/x", undefined)).rejects.toMatchObject({ status: 304 });
  });
});

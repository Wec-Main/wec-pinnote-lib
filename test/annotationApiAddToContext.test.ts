import { afterEach, describe, expect, it, vi } from "vitest";
import { createAnnotationApi } from "../src/services/annotationService";

const BASE = "https://api.example.com";

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi
    .fn()
    .mockImplementation(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function lastCall(fetchMock: ReturnType<typeof stubFetch>) {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, init };
}

const api = createAnnotationApi({ apiBaseUrl: BASE, getAuthToken: async () => "tok" });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("annotationApi addToContext", () => {
  it("sends addToContext when creating a reply", async () => {
    const fetchMock = stubFetch(201, { id: "c1", addToContext: true });
    const result = await api.createComment("a1", { message: "hi", addToContext: true });
    const { url, init } = lastCall(fetchMock);
    expect(url).toContain("/annotations/a1/comments");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ message: "hi", addToContext: true });
    expect(result.addToContext).toBe(true);
  });

  it("sends addToContext on the first comment of a new annotation", async () => {
    const fetchMock = stubFetch(201, { id: "a1" });
    await api.createAnnotation({
      projectId: "p",
      pageKey: "/",
      anchor: {
        selector: "#a",
        elementIdentifier: "a",
        relativeX: 0,
        relativeY: 0,
        fallbackX: 0,
        fallbackY: 0,
        viewportWidth: 1,
        viewportHeight: 1,
      },
      comment: { message: "hi", addToContext: false },
    });
    const body = JSON.parse(lastCall(fetchMock).init.body as string);
    expect(body.comment).toEqual({ message: "hi", addToContext: false });
  });

  it("PATCHes only addToContext when toggling", async () => {
    const fetchMock = stubFetch(200, { id: "c1", addToContext: false });
    await api.updateComment("a1", "c1", { addToContext: false });
    const { url, init } = lastCall(fetchMock);
    expect(url).toContain("/annotations/a1/comments/c1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ addToContext: false });
  });
});

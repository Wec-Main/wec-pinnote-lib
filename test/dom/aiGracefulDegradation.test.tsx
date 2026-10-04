import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnnotationProvider } from "../../src/context/AnnotationProvider";
import { flush, jsonResponse } from "./aiTestUtils";

let container: HTMLDivElement;
let root: Root;
let eventSourceUrls: string[] = [];
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset().mockImplementation(async (url: string) => {
    const path = new URL(String(url), "http://local.invalid").pathname;
    if (path.includes("/ai/")) return jsonResponse({ error: "Not found" }, 404);
    if (path.endsWith("/stream/ticket")) return jsonResponse({ error: "Not found" }, 404);
    return jsonResponse([]);
  });
  vi.stubGlobal("fetch", fetchMock);
  eventSourceUrls = [];
  vi.stubGlobal(
    "EventSource",
    class {
      constructor(url: string) {
        eventSourceUrls.push(String(url));
      }
      addEventListener() {}
      close() {}
    },
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("AI UI without /ai routes", () => {
  it("renders no AI controls and never opens the AI stream", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    act(() =>
      root.render(
        createElement(
          AnnotationProvider,
          {
            config: {
              apiBaseUrl: "https://api.example.com",
              projectId: "p1",
              currentUser: { id: "u1", name: "Kavi" },
              getAuthToken: () => "tok",
            },
          },
          createElement("main", null, "host app"),
        ),
      ),
    );
    await flush(30);
    expect(container.textContent).toContain("host app");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/ai/me"))).toBe(true);
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes("/ai/stream")).length,
    ).toBeLessThanOrEqual(1);
    expect(eventSourceUrls.filter((url) => url.includes("/ai/stream"))).toEqual([]);
    expect(document.body.querySelector('[aria-label="AI integrations"]')).toBeNull();
    expect(document.body.querySelector(".wpn-ai-fab")).toBeNull();
    const aiErrors = errors.mock.calls.filter((call) =>
      String(call[0]).toLowerCase().includes("ai"),
    );
    expect(aiErrors).toEqual([]);
    errors.mockRestore();
  });
});

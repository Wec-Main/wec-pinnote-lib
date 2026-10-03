import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAnnotationTags, type AnnotationTagsState } from "../../src/hooks/useAnnotationTags";
import type { AnnotationTag } from "../../src/types/annotationTag.types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const fetchAnnotationTags = vi.fn();
const fetchPreferences = vi.fn();
const saveTagsVisible = vi.fn();
const createAnnotationTag = vi.fn();
const deleteAnnotationTag = vi.fn();
const updateAnnotationTag = vi.fn();

vi.mock("../../src/services/annotationTagsApi", () => ({
  fetchAnnotationTags: (...args: unknown[]) => fetchAnnotationTags(...args),
  fetchPreferences: (...args: unknown[]) => fetchPreferences(...args),
  saveTagsVisible: (...args: unknown[]) => saveTagsVisible(...args),
  createAnnotationTag: (...args: unknown[]) => createAnnotationTag(...args),
  deleteAnnotationTag: (...args: unknown[]) => deleteAnnotationTag(...args),
  updateAnnotationTag: (...args: unknown[]) => updateAnnotationTag(...args),
}));

function tag(id: string): AnnotationTag {
  return {
    id,
    projectId: "project-1",
    pageKey: "/home",
    tagId: "tag-1",
    tagName: "Bug",
    anchor: {
      selector: "",
      elementIdentifier: "x",
      relativeX: 0,
      relativeY: 0,
      fallbackX: 0,
      fallbackY: 0,
      viewportWidth: 0,
      viewportHeight: 0,
    },
    createdById: null,
    createdByUser: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as AnnotationTag;
}

let container: HTMLDivElement;
let root: Root;
let latest: AnnotationTagsState | null = null;

function Harness({ pageKey }: { pageKey: string }) {
  latest = useAnnotationTags({
    apiBaseUrl: "https://api.example.test",
    projectId: "project-1",
    projectVersionId: "v1",
    pageKey,
    getAuthToken: () => "token",
    sessionKey: "session",
    enabled: true,
  });
  return null;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  fetchAnnotationTags.mockReset().mockResolvedValue([]);
  fetchPreferences.mockReset().mockResolvedValue({ tagsVisible: true });
  saveTagsVisible.mockReset();
  createAnnotationTag.mockReset();
  deleteAnnotationTag.mockReset();
  updateAnnotationTag.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  latest = null;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("useAnnotationTags (on usePageScopedResource)", () => {
  it("loads tags for the given scope on mount", async () => {
    const loaded = tag("tag-pin-1");
    fetchAnnotationTags.mockResolvedValue([loaded]);

    act(() => root.render(createElement(Harness, { pageKey: "/home" })));
    await flush();

    expect(fetchAnnotationTags).toHaveBeenCalledWith(
      "https://api.example.test",
      "token",
      "project-1",
      "/home",
      "v1",
      expect.any(AbortSignal),
    );
    expect(latest!.annotationTags).toEqual([loaded]);
  });

  it("refetches when reloadAnnotationTags is called", async () => {
    act(() => root.render(createElement(Harness, { pageKey: "/home" })));
    await flush();
    expect(fetchAnnotationTags).toHaveBeenCalledTimes(1);

    act(() => latest!.reloadAnnotationTags());
    await flush();
    expect(fetchAnnotationTags).toHaveBeenCalledTimes(2);
  });

  it("clears tags and cancels any draft when the page scope changes", async () => {
    const loaded = tag("tag-pin-1");
    fetchAnnotationTags.mockResolvedValue([loaded]);

    act(() => root.render(createElement(Harness, { pageKey: "/home" })));
    await flush();
    expect(latest!.annotationTags).toEqual([loaded]);

    act(() => latest!.startTagDraft({
      selector: "",
      elementIdentifier: "x",
      relativeX: 0,
      relativeY: 0,
      fallbackX: 0,
      fallbackY: 0,
      viewportWidth: 0,
      viewportHeight: 0,
    }, "label"));
    expect(latest!.tagDraft).not.toBeNull();

    fetchAnnotationTags.mockResolvedValue([]);
    act(() => root.render(createElement(Harness, { pageKey: "/other" })));
    expect(latest!.annotationTags).toEqual([]);
    expect(latest!.tagDraft).toBeNull();

    await flush();
    expect(fetchAnnotationTags).toHaveBeenLastCalledWith(
      "https://api.example.test",
      "token",
      "project-1",
      "/other",
      "v1",
      expect.any(AbortSignal),
    );
  });
});

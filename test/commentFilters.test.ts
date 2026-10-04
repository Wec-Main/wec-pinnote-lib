import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMMENT_FILTERS,
  authorOptions,
  filterThreads,
  filtersActive,
  groupThreadsByPage,
  statusOptions,
  toThreads,
  type CommentFilters,
} from "../src/features/annotation/components/AnnotationListPanel/commentFilters";
import type { Annotation, AnnotationStatus } from "../src/types/annotation.types";

function annotation(
  id: string,
  number: number,
  status: AnnotationStatus,
  comments: { id: string; message: string; authorId: string; authorName: string; at: string }[],
): Annotation {
  return {
    id,
    projectId: "demo",
    pageKey: "/home",
    number,
    status,
    anchor: {
      selector: "#x",
      elementIdentifier: "hero_banner",
      relativeX: 0,
      relativeY: 0,
      fallbackX: 0,
      fallbackY: 0,
      viewportWidth: 1,
      viewportHeight: 1,
    },
    comments: comments.map((comment) => ({
      id: comment.id,
      message: comment.message,
      createdBy: { id: comment.authorId, name: comment.authorName },
      createdAt: comment.at,
      updatedAt: comment.at,
    })),
    createdBy: { id: "u1", name: "Ada Lovelace" },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const openAnnotation = annotation("a1", 1, "open", [
  {
    id: "c1",
    message: "Header is misaligned",
    authorId: "u1",
    authorName: "Ada Lovelace",
    at: "2026-01-01T10:00:00.000Z",
  },
  {
    id: "c2",
    message: "Agreed, shifting it",
    authorId: "u2",
    authorName: "Rahul Menon",
    at: "2026-01-02T10:00:00.000Z",
  },
]);

const doneAnnotation = annotation("a2", 2, "completed", [
  {
    id: "c3",
    message: "Footer copy fixed",
    authorId: "u2",
    authorName: "Rahul Menon",
    at: "2026-01-03T10:00:00.000Z",
  },
]);

const all = toThreads([openAnnotation, doneAnnotation]);

function withFilters(overrides: Partial<CommentFilters>): CommentFilters {
  return { ...DEFAULT_COMMENT_FILTERS, ...overrides };
}

function pinIds(filters: CommentFilters, currentUserId = "u1", currentPageKey = "/home"): string[] {
  return filterThreads(all, filters, currentUserId, currentPageKey).map(
    (thread) => thread.annotation.id,
  );
}

describe("toThreads", () => {
  it("puts the first comment as the parent and the rest as replies", () => {
    expect(all).toHaveLength(2);
    expect(all[0]?.root.id).toBe("c1");
    expect(all[0]?.replies.map((reply) => reply.id)).toEqual(["c2"]);
    expect(all[1]?.replies).toEqual([]);
  });

  it("tracks the latest comment time and humanizes the element identifier", () => {
    expect(all[0]?.lastActivityAt).toBe("2026-01-02T10:00:00.000Z");
    expect(all[0]?.label).toBe("hero banner");
  });

  it("prefers the last segment of path over the element identifier when path is present", () => {
    const withPath = {
      ...openAnnotation,
      id: "a4",
      path: "Login Page > Username Field",
    };
    expect(toThreads([withPath])[0]?.label).toBe("Username Field");
  });

  it("skips annotations without comments", () => {
    expect(toThreads([annotation("a3", 3, "open", [])])).toEqual([]);
  });
});

describe("filterThreads", () => {
  it("sorts by latest activity by default", () => {
    expect(pinIds(DEFAULT_COMMENT_FILTERS)).toEqual(["a2", "a1"]);
  });

  it("sorts oldest first", () => {
    expect(pinIds(withFilters({ sort: "oldest" }))).toEqual(["a1", "a2"]);
  });

  it("splits resolved from unresolved by annotation status", () => {
    expect(pinIds(withFilters({ resolution: "open" }))).toEqual(["a1"]);
    expect(pinIds(withFilters({ resolution: "resolved" }))).toEqual(["a2"]);
  });

  it("keeps a thread when any of its comments matches the author", () => {
    expect(pinIds(withFilters({ author: "u2" }))).toEqual(["a2", "a1"]);
  });

  it("limits to threads the current user took part in when mineOnly is set", () => {
    expect(pinIds(withFilters({ mineOnly: true }))).toEqual(["a1"]);
  });

  it("limits to the current page's threads when thisPageOnly is set", () => {
    const pricing = {
      ...openAnnotation,
      id: "a4",
      pageKey: "/pricing",
    };
    const withOtherPage = toThreads([pricing, openAnnotation, doneAnnotation]);
    const ids = filterThreads(
      withOtherPage,
      withFilters({ thisPageOnly: true }),
      "u1",
      "/home",
    ).map((thread) => thread.annotation.id);
    expect(ids).toEqual(["a2", "a1"]);
  });

  it("filters by annotation status and combines filters conjunctively", () => {
    expect(pinIds(withFilters({ status: "completed" }))).toEqual(["a2"]);
    expect(pinIds(withFilters({ author: "u2", resolution: "open" }))).toEqual(["a1"]);
  });

  it("does not mutate the threads it is given", () => {
    const order = all.map((thread) => thread.annotation.id);
    filterThreads(all, withFilters({ sort: "oldest" }), "u1", "/home");

    expect(all.map((thread) => thread.annotation.id)).toEqual(order);
  });
});

describe("filtersActive", () => {
  it("is false for the defaults and true for any change", () => {
    expect(filtersActive(DEFAULT_COMMENT_FILTERS)).toBe(false);
    expect(filtersActive(withFilters({ status: "open" }))).toBe(true);
    expect(filtersActive(withFilters({ author: "u2" }))).toBe(true);
    expect(filtersActive(withFilters({ resolution: "resolved" }))).toBe(true);
    expect(filtersActive(withFilters({ mineOnly: true }))).toBe(true);
    expect(filtersActive(withFilters({ thisPageOnly: true }))).toBe(true);
    expect(filtersActive(withFilters({ sort: "oldest" }))).toBe(true);
  });
});

describe("option builders", () => {
  it("lists each author once, sorted by name", () => {
    expect(authorOptions(all)).toEqual([
      { value: "u1", label: "Ada Lovelace" },
      { value: "u2", label: "Rahul Menon" },
    ]);
  });

  it("offers only statuses present in the data, in canonical order", () => {
    expect(statusOptions(all)).toEqual([
      { value: "open", label: "Open" },
      { value: "completed", label: "Completed" },
    ]);
  });
});

describe("groupThreadsByPage", () => {
  const pricing: Annotation = {
    ...annotation("a3", 3, "open", [
      {
        id: "c4",
        message: "Price is wrong",
        authorId: "u1",
        authorName: "Ada Lovelace",
        at: "2026-01-04T10:00:00.000Z",
      },
    ]),
    pageKey: "/pricing::annual",
    path: "Pricing > Plan card",
  };
  const threads = toThreads([pricing, openAnnotation, doneAnnotation]);

  it("puts the current page first and keeps the thread order within each page", () => {
    const groups = groupThreadsByPage(threads, "/home");
    expect(groups.map((group) => group.pageKey)).toEqual(["/home", "/pricing::annual"]);
    expect(groups[0]?.current).toBe(true);
    expect(groups[0]?.threads.map((thread) => thread.annotation.id)).toEqual(["a1", "a2"]);
  });

  it("counts unresolved threads and names the page from its path title", () => {
    const [home, pricingGroup] = groupThreadsByPage(threads, "/home");
    expect(home?.openCount).toBe(1);
    expect(home?.title).toBe("/home");
    expect(pricingGroup?.title).toBe("Pricing");
    expect(pricingGroup?.location).toBe("/pricing · annual");
  });
});

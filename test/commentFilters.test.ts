import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMMENT_FILTERS,
  authorOptions,
  filterEntries,
  filtersActive,
  groupByAnnotation,
  statusOptions,
  toEntries,
  type CommentFilters,
} from "../src/components/AnnotationListPanel/commentFilters";
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

const all = toEntries([openAnnotation, doneAnnotation]);

function withFilters(overrides: Partial<CommentFilters>): CommentFilters {
  return { ...DEFAULT_COMMENT_FILTERS, ...overrides };
}

describe("toEntries", () => {
  it("flattens every comment and marks replies by position", () => {
    expect(all).toHaveLength(3);
    expect(all[0]?.replyIndex).toBe(0);
    expect(all[1]?.replyIndex).toBe(1);
    expect(all[0]?.replyCount).toBe(2);
  });

  it("humanizes the element identifier", () => {
    expect(all[0]?.label).toBe("hero banner");
  });
});

describe("filterEntries", () => {
  it("sorts newest first by default", () => {
    const result = filterEntries(all, DEFAULT_COMMENT_FILTERS, "u1");

    expect(result.map((entry) => entry.comment.id)).toEqual(["c3", "c2", "c1"]);
  });

  it("sorts oldest first and by pin number", () => {
    expect(
      filterEntries(all, withFilters({ sort: "oldest" }), "u1").map((entry) => entry.comment.id),
    ).toEqual(["c1", "c2", "c3"]);
    expect(
      filterEntries(all, withFilters({ sort: "pin" }), "u1").map((entry) => entry.comment.id),
    ).toEqual(["c1", "c2", "c3"]);
  });

  it("splits resolved from unresolved by annotation status", () => {
    expect(filterEntries(all, withFilters({ resolution: "open" }), "u1")).toHaveLength(2);
    expect(filterEntries(all, withFilters({ resolution: "resolved" }), "u1")).toHaveLength(1);
  });

  it("filters by author id rather than display name", () => {
    const result = filterEntries(all, withFilters({ author: "u2" }), "u1");

    expect(result.map((entry) => entry.comment.id)).toEqual(["c3", "c2"]);
  });

  it("limits to the current user when mineOnly is set", () => {
    const result = filterEntries(all, withFilters({ mineOnly: true }), "u1");

    expect(result.map((entry) => entry.comment.id)).toEqual(["c1"]);
  });

  it("filters by annotation status", () => {
    expect(filterEntries(all, withFilters({ status: "completed" }), "u1")).toHaveLength(1);
  });

  it("combines filters conjunctively", () => {
    const result = filterEntries(all, withFilters({ author: "u2", resolution: "open" }), "u1");

    expect(result.map((entry) => entry.comment.id)).toEqual(["c2"]);
  });

  it("does not mutate the entries it is given", () => {
    const order = all.map((entry) => entry.comment.id);
    filterEntries(all, withFilters({ sort: "oldest" }), "u1");

    expect(all.map((entry) => entry.comment.id)).toEqual(order);
  });
});

describe("filtersActive", () => {
  it("is false for the defaults and true for any change", () => {
    expect(filtersActive(DEFAULT_COMMENT_FILTERS)).toBe(false);
    expect(filtersActive(withFilters({ status: "open" }))).toBe(true);
    expect(filtersActive(withFilters({ author: "u2" }))).toBe(true);
    expect(filtersActive(withFilters({ resolution: "resolved" }))).toBe(true);
    expect(filtersActive(withFilters({ mineOnly: true }))).toBe(true);
    expect(filtersActive(withFilters({ sort: "pin" }))).toBe(true);
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

describe("groupByAnnotation", () => {
  it("keeps comments of one annotation together in filtered order", () => {
    const groups = groupByAnnotation(filterEntries(all, DEFAULT_COMMENT_FILTERS, "u1"));

    expect([...groups.keys()]).toEqual(["a2", "a1"]);
    expect(groups.get("a1")?.map((entry) => entry.comment.id)).toEqual(["c2", "c1"]);
  });
});

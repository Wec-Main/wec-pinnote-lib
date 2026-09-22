import { describe, expect, it } from "vitest";
import { applyStreamEvent } from "../src/utils/applyStreamEvent";
import type { Annotation, AnnotationComment } from "../src/types/annotation.types";
import type { StreamEvent, StreamEventType } from "../src/types/stream.types";

const user = { id: "user-1", name: "Priya" };

function comment(id: string, message: string, updatedAt: string): AnnotationComment {
  return { id, message, createdBy: user, createdAt: updatedAt, updatedAt };
}

function annotation(id: string, number: number, updatedAt: string): Annotation {
  return {
    id,
    projectId: "project-1",
    pageKey: "/login",
    number,
    anchor: {
      selector: "#a",
      elementIdentifier: "a",
      relativeX: 0.5,
      relativeY: 0.5,
      fallbackX: 10,
      fallbackY: 10,
      viewportWidth: 1440,
      viewportHeight: 900,
    },
    status: "open",
    comments: [],
    createdBy: user,
    createdAt: updatedAt,
    updatedAt,
  };
}

function event(eventType: StreamEventType, payload: unknown, eventId = "1"): StreamEvent {
  return {
    eventId,
    projectId: "project-1",
    pageKey: "/login",
    eventType,
    annotationId: null,
    commentId: null,
    actorUserId: "user-2",
    payload,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("applyStreamEvent", () => {
  it("adds a new annotation in number order", () => {
    const existing = [annotation("a-2", 2, "2026-01-01T00:00:00.000Z")];
    const incoming = annotation("a-1", 1, "2026-01-01T00:00:01.000Z");

    const result = applyStreamEvent(
      existing,
      event("annotation.created", { annotation: incoming }),
    );

    expect(result.annotations.map((item) => item.id)).toEqual(["a-1", "a-2"]);
  });

  it("does not duplicate an annotation the client already has", () => {
    const existing = [annotation("a-1", 1, "2026-01-01T00:00:00.000Z")];
    const incoming = annotation("a-1", 1, "2026-01-01T00:00:00.000Z");

    const result = applyStreamEvent(
      existing,
      event("annotation.created", { annotation: incoming }),
    );

    expect(result.annotations).toHaveLength(1);
  });

  it("keeps locally known comments when an annotation payload arrives", () => {
    const local = annotation("a-1", 1, "2026-01-01T00:00:00.000Z");
    local.comments = [comment("c-1", "local", "2026-01-01T00:00:00.000Z")];
    const incoming = annotation("a-1", 1, "2026-01-01T00:00:05.000Z");

    const result = applyStreamEvent([local], event("annotation.updated", { annotation: incoming }));

    expect(result.annotations[0]?.comments.map((item) => item.id)).toEqual(["c-1"]);
  });

  it("ignores an annotation update older than local state", () => {
    const local = annotation("a-1", 1, "2026-01-01T00:00:10.000Z");
    local.status = "completed";
    const stale = annotation("a-1", 1, "2026-01-01T00:00:00.000Z");

    const result = applyStreamEvent([local], event("annotation.updated", { annotation: stale }));

    expect(result.annotations[0]?.status).toBe("completed");
  });

  it("appends a streamed comment", () => {
    const local = annotation("a-1", 1, "2026-01-01T00:00:00.000Z");
    const incoming = comment("c-9", "from another user", "2026-01-01T00:00:02.000Z");

    const result = applyStreamEvent(
      [local],
      event("comment.created", { annotationId: "a-1", comment: incoming }),
    );

    expect(result.annotations[0]?.comments.map((item) => item.message)).toEqual([
      "from another user",
    ]);
  });

  it("replaces rather than duplicates an echoed comment", () => {
    const local = annotation("a-1", 1, "2026-01-01T00:00:00.000Z");
    local.comments = [comment("c-1", "mine", "2026-01-01T00:00:00.000Z")];
    const echoed = comment("c-1", "mine", "2026-01-01T00:00:00.000Z");

    const result = applyStreamEvent(
      [local],
      event("comment.created", { annotationId: "a-1", comment: echoed }),
    );

    expect(result.annotations[0]?.comments).toHaveLength(1);
  });

  it("ignores a comment edit older than local state", () => {
    const local = annotation("a-1", 1, "2026-01-01T00:00:00.000Z");
    local.comments = [comment("c-1", "newer", "2026-01-01T00:00:10.000Z")];
    const stale = comment("c-1", "older", "2026-01-01T00:00:00.000Z");

    const result = applyStreamEvent(
      [local],
      event("comment.updated", { annotationId: "a-1", comment: stale }),
    );

    expect(result.annotations[0]?.comments[0]?.message).toBe("newer");
  });

  it("removes a deleted comment", () => {
    const local = annotation("a-1", 1, "2026-01-01T00:00:00.000Z");
    local.comments = [comment("c-1", "bye", "2026-01-01T00:00:00.000Z")];

    const result = applyStreamEvent(
      [local],
      event("comment.deleted", { annotationId: "a-1", commentId: "c-1" }),
    );

    expect(result.annotations[0]?.comments).toHaveLength(0);
  });

  it("removes a deleted annotation", () => {
    const result = applyStreamEvent(
      [annotation("a-1", 1, "2026-01-01T00:00:00.000Z")],
      event("annotation.deleted", { annotationId: "a-1" }),
    );

    expect(result.annotations).toHaveLength(0);
  });

  it("reports a page status change", () => {
    const result = applyStreamEvent(
      [],
      event("page-status.updated", { pageStatus: { status: "approved" } }),
    );

    expect(result.pageStatus).toBe("approved");
  });

  it("leaves state untouched for a malformed payload", () => {
    const local = [annotation("a-1", 1, "2026-01-01T00:00:00.000Z")];

    const result = applyStreamEvent(local, event("comment.created", null));

    expect(result.annotations).toBe(local);
  });
});

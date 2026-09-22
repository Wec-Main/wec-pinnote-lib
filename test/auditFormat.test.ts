import { describe, expect, it } from "vitest";
import {
  ACTION_OPTIONS,
  actionMeta,
  diffFields,
  entityLabel,
  summarize,
} from "../src/components/AuditHistory/auditFormat";
import type { AuditRecord } from "../src/types/audit.types";

function record(overrides: Partial<AuditRecord> = {}): AuditRecord {
  return {
    auditId: "1",
    actorUserId: "user-1",
    actorName: "Ada Lovelace",
    action: "user.updated",
    entityType: "user",
    entityId: "user-2",
    organizationId: "org-1",
    projectId: "demo",
    pageKey: "/home",
    beforeData: null,
    afterData: null,
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("actionMeta", () => {
  it("labels every action the backend emits", () => {
    const emitted = [
      "auth.login",
      "auth.login-failed",
      "auth.logout",
      "annotation.created",
      "annotation.status-changed",
      "annotation.deleted",
      "comment.created",
      "comment.updated",
      "comment.deleted",
      "page-status.updated",
      "user.created",
      "user.updated",
      "user.deleted",
      "user.password-reset",
      "organization.created",
      "organization.updated",
      "organization.deleted",
      "project.created",
      "project.updated",
      "project.deleted",
      "epic.created",
      "epic.updated",
      "epic.deleted",
      "user_story.created",
      "user_story.updated",
      "user_story.deleted",
      "annotation_tag.created",
      "annotation_tag.deleted",
      "tag.created",
      "tag.updated",
      "tag.deleted",
    ];

    for (const action of emitted) {
      expect(actionMeta(action).label).not.toBe(action);
    }
    expect(ACTION_OPTIONS).toHaveLength(emitted.length);
  });

  it("falls back to the raw action when unknown", () => {
    expect(actionMeta("future.action")).toEqual({ label: "future.action", tone: "neutral" });
  });

  it("tones destructive actions as danger", () => {
    expect(actionMeta("annotation.deleted").tone).toBe("danger");
    expect(actionMeta("auth.login-failed").tone).toBe("danger");
  });
});

describe("diffFields", () => {
  it("reports only changed fields", () => {
    const changes = diffFields(
      record({
        beforeData: { firstName: "Ada", status: "active" },
        afterData: { firstName: "Ada", status: "suspended" },
      }),
    );

    expect(changes).toEqual([{ field: "Status", before: "active", after: "suspended" }]);
  });

  it("ignores bookkeeping timestamps", () => {
    const changes = diffFields(
      record({
        beforeData: { status: "active", updatedAt: "a" },
        afterData: { status: "active", updatedAt: "b" },
      }),
    );

    expect(changes).toEqual([]);
  });

  it("represents creation and deletion as one-sided changes", () => {
    const created = diffFields(record({ beforeData: null, afterData: { status: "active" } }));
    expect(created).toEqual([{ field: "Status", before: null, after: "active" }]);

    const deleted = diffFields(record({ beforeData: { status: "active" }, afterData: null }));
    expect(deleted).toEqual([{ field: "Status", before: "active", after: null }]);
  });

  it("tolerates non-object payloads", () => {
    expect(diffFields(record({ beforeData: "nope", afterData: 42 }))).toEqual([]);
  });
});

describe("entityLabel and summarize", () => {
  it("humanizes known entity types", () => {
    expect(entityLabel("annotation_comment")).toBe("Comment");
    expect(entityLabel("page_status")).toBe("Page status");
    expect(entityLabel("mystery")).toBe("mystery");
  });

  it("joins page and truncated entity id", () => {
    expect(summarize(record({ pageKey: "/home", entityId: "abcdefghijklmnop" }))).toBe(
      "/home · abcdefgh…",
    );
    expect(summarize(record({ pageKey: null, entityId: null }))).toBe("");
  });
});

describe("value rendering", () => {
  it("renders booleans and slug codes as words", () => {
    const changes = diffFields(
      record({
        beforeData: { active: true, role: "org-admin" },
        afterData: { active: false, role: "read-only" },
      }),
    );

    expect(changes).toEqual([
      { field: "Active", before: "Yes", after: "No" },
      { field: "Role", before: "Org admin", after: "Read only" },
    ]);
  });

  it("leaves ordinary text untouched", () => {
    const changes = diffFields(
      record({
        beforeData: { message: "Fix the header" },
        afterData: { message: "Fix the footer" },
      }),
    );

    expect(changes).toEqual([
      { field: "Message", before: "Fix the header", after: "Fix the footer" },
    ]);
  });

  it("flattens nested payloads into dotted field paths instead of JSON", () => {
    const changes = diffFields(
      record({
        beforeData: { createdBy: { name: "Ada" } },
        afterData: { createdBy: { name: "Grace" } },
      }),
    );

    expect(changes).toEqual([{ field: "Created by name", before: "Ada", after: "Grace" }]);
  });

  it("never emits raw JSON braces", () => {
    const changes = diffFields(
      record({
        beforeData: { anchor: { selector: "#a", relativeX: 0.5 } },
        afterData: { anchor: { selector: "#b", relativeX: 0.5 } },
      }),
    );

    for (const change of changes) {
      expect(change.before ?? "").not.toContain("{");
      expect(change.after ?? "").not.toContain("{");
    }
    expect(changes).toHaveLength(1);
  });
});

describe("comment content", () => {
  it("shows the message a user typed when an annotation is created", () => {
    const changes = diffFields(
      record({
        action: "annotation.created",
        beforeData: null,
        afterData: { number: 3, status: "open", comment: "Please fix this heading" },
      }),
    );

    expect(changes).toContainEqual({
      field: "Comment",
      before: null,
      after: "Please fix this heading",
    });
  });

  it("shows both sides of an edited comment", () => {
    const changes = diffFields(
      record({
        action: "comment.updated",
        beforeData: { message: "Fix heading", author: "Ada Lovelace" },
        afterData: { message: "Fix the heading copy", author: "Ada Lovelace" },
      }),
    );

    expect(changes).toEqual([
      { field: "Message", before: "Fix heading", after: "Fix the heading copy" },
    ]);
  });

  it("keeps a deleted annotation's thread readable", () => {
    const changes = diffFields(
      record({
        action: "annotation.deleted",
        beforeData: { number: 2, thread: "Ada: first\nGrace: second" },
        afterData: null,
      }),
    );

    expect(changes).toContainEqual({
      field: "Thread",
      before: "Ada: first\nGrace: second",
      after: null,
    });
  });
});

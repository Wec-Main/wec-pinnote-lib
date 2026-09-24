import { describe, expect, it } from "vitest";
import { canDeleteComment, canEditComment } from "../src/utils/boardPermissions";
import type { AnnotationComment, AnnotationUser } from "../src/types/annotation.types";

function comment(authorId: string, authorName = "Ada Lovelace"): AnnotationComment {
  return {
    id: "c1",
    message: "Looks good",
    createdBy: { id: authorId, name: authorName },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const owner: AnnotationUser = { id: "u1", name: "Ada Lovelace" };
const contributor: AnnotationUser = { id: "u2", name: "Rahul Menon", role: "contributor" };
const admin: AnnotationUser = { id: "u3", name: "Hannah Weiss", role: "admin" };
const superAdmin: AnnotationUser = { id: "u4", name: "Priya Raghavan", role: "super_admin" };

describe("canDeleteComment", () => {
  it("lets the author delete their own comment", () => {
    expect(canDeleteComment(comment("u1"), owner)).toBe(true);
  });

  it("lets an admin and a super admin moderate another user's comment", () => {
    expect(canDeleteComment(comment("u1"), admin)).toBe(true);
    expect(canDeleteComment(comment("u1"), superAdmin)).toBe(true);
  });

  it("stops a contributor deleting another contributor's comment", () => {
    expect(canDeleteComment(comment("u1"), contributor)).toBe(false);
  });

  it("stops a user with no role deleting someone else's comment", () => {
    expect(canDeleteComment(comment("u1"), { id: "u9", name: "Nobody" })).toBe(false);
  });

  it("matches on id, not display name", () => {
    const sameNameDifferentPerson: AnnotationUser = { id: "u9", name: "Ada Lovelace" };

    expect(canDeleteComment(comment("u1"), sameNameDifferentPerson)).toBe(false);
  });
});

describe("canEditComment", () => {
  it("lets the author edit their own comment", () => {
    expect(canEditComment(comment("u1"), owner)).toBe(true);
  });

  it("lets an admin and a super admin edit another user's comment", () => {
    expect(canEditComment(comment("u1"), admin)).toBe(true);
    expect(canEditComment(comment("u1"), superAdmin)).toBe(true);
  });

  it("stops a contributor editing another contributor's comment", () => {
    expect(canEditComment(comment("u1"), contributor)).toBe(false);
  });

  it("stops a user with no role editing someone else's comment", () => {
    expect(canEditComment(comment("u1"), { id: "u9", name: "Nobody" })).toBe(false);
  });

  it("matches on id, not display name", () => {
    const sameNameDifferentPerson: AnnotationUser = { id: "u9", name: "Ada Lovelace" };

    expect(canEditComment(comment("u1"), sameNameDifferentPerson)).toBe(false);
  });
});

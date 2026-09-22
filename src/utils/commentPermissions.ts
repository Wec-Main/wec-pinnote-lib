import type { AnnotationComment, AnnotationUser } from "../types/annotation.types";

const MODERATOR_ROLES = new Set(["admin", "super_admin"]);

function owns(comment: AnnotationComment, currentUser: AnnotationUser): boolean {
  return comment.createdBy.id === currentUser.id;
}

/**
 * Comments are collaborative, so any signed-in member may revise one whoever
 * wrote it. Deleting is not recoverable from the audit log the way an edit is,
 * so it stays with the author and the admins who moderate the thread.
 */
export function canEditComment(): boolean {
  return true;
}

export function canDeleteComment(comment: AnnotationComment, currentUser: AnnotationUser): boolean {
  return owns(comment, currentUser) || MODERATOR_ROLES.has(currentUser.role ?? "");
}

import type { AnnotationComment, AnnotationUser } from "../types/annotation.types";

const MODERATOR_ROLES = new Set(["admin", "super_admin"]);

function owns(comment: AnnotationComment, currentUser: AnnotationUser): boolean {
  return comment.createdBy.id === currentUser.id;
}

export function canEditComment(comment: AnnotationComment, currentUser: AnnotationUser): boolean {
  return owns(comment, currentUser);
}

export function canDeleteComment(comment: AnnotationComment, currentUser: AnnotationUser): boolean {
  return owns(comment, currentUser) || MODERATOR_ROLES.has(currentUser.role ?? "");
}

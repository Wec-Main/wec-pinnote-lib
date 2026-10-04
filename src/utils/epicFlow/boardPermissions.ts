import type { Annotation, AnnotationComment, AnnotationUser } from "../../types/annotation.types";

const MODERATOR_ROLES = new Set(["admin", "super_admin"]);

function isOwnerOrModerator(ownerId: string | null, currentUser: AnnotationUser): boolean {
  return ownerId === currentUser.id || MODERATOR_ROLES.has(currentUser.role ?? "");
}

export function canEditComment(comment: AnnotationComment, currentUser: AnnotationUser): boolean {
  return isOwnerOrModerator(comment.createdBy.id, currentUser);
}

export const canDeleteComment = canEditComment;

export function canDeleteAnnotation(annotation: Annotation, currentUser: AnnotationUser): boolean {
  return isOwnerOrModerator(annotation.createdBy.id, currentUser);
}

export function canEditBoardItem(): boolean {
  return true;
}

export function canDeleteBoardItem(
  createdById: string | null,
  currentUser: AnnotationUser,
): boolean {
  return isOwnerOrModerator(createdById, currentUser);
}

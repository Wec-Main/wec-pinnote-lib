import type { Annotation, AnnotationComment, AnnotationUser } from "../types/annotation.types";

const MODERATOR_ROLES = new Set(["admin", "super_admin"]);

function owns(entity: { createdBy: AnnotationUser }, currentUser: AnnotationUser): boolean {
  return entity.createdBy.id === currentUser.id;
}

export function canEditComment(comment: AnnotationComment, currentUser: AnnotationUser): boolean {
  return owns(comment, currentUser) || MODERATOR_ROLES.has(currentUser.role ?? "");
}

export function canDeleteComment(comment: AnnotationComment, currentUser: AnnotationUser): boolean {
  return owns(comment, currentUser) || MODERATOR_ROLES.has(currentUser.role ?? "");
}

export function canDeleteAnnotation(annotation: Annotation, currentUser: AnnotationUser): boolean {
  return owns(annotation, currentUser) || MODERATOR_ROLES.has(currentUser.role ?? "");
}

export function canEditBoardItem(): boolean {
  return true;
}

export function canDeleteBoardItem(
  createdById: string | null,
  currentUser: AnnotationUser,
): boolean {
  return createdById === currentUser.id || MODERATOR_ROLES.has(currentUser.role ?? "");
}

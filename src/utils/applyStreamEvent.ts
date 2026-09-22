import type { Annotation, AnnotationComment, PageStatus } from "../types/annotation.types";
import type { StreamEvent } from "../types/stream.types";

function isNewer(incoming: string, existing: string): boolean {
  return new Date(incoming).getTime() >= new Date(existing).getTime();
}

function upsertComment(
  comments: AnnotationComment[],
  incoming: AnnotationComment,
): AnnotationComment[] {
  const existing = comments.find((item) => item.id === incoming.id);
  if (!existing) {
    return [...comments, incoming];
  }
  if (!isNewer(incoming.updatedAt, existing.updatedAt)) {
    return comments;
  }
  return comments.map((item) => (item.id === incoming.id ? incoming : item));
}

function upsertAnnotation(annotations: Annotation[], incoming: Annotation): Annotation[] {
  const existing = annotations.find((item) => item.id === incoming.id);
  if (!existing) {
    return [...annotations, incoming].sort((a, b) => a.number - b.number);
  }
  if (!isNewer(incoming.updatedAt, existing.updatedAt)) {
    return annotations;
  }
  // Comments arrive through their own events; keep locally known ones so a
  // stale annotation payload cannot drop a comment this client already has.
  return annotations.map((item) =>
    item.id === incoming.id ? { ...incoming, comments: item.comments } : item,
  );
}

export interface StreamApplication {
  annotations: Annotation[];
  pageStatus: PageStatus | null;
}

export function applyStreamEvent(
  annotations: Annotation[],
  event: StreamEvent,
): StreamApplication {
  const unchanged: StreamApplication = { annotations, pageStatus: null };
  const payload = event.payload;
  if (!payload || typeof payload !== "object") {
    return unchanged;
  }

  switch (event.eventType) {
    case "annotation.created":
    case "annotation.updated": {
      const { annotation } = payload as { annotation: Annotation };
      if (!annotation) {
        return unchanged;
      }
      if (event.eventType === "annotation.created") {
        const existing = annotations.find((item) => item.id === annotation.id);
        if (!existing) {
          return {
            annotations: [...annotations, annotation].sort((a, b) => a.number - b.number),
            pageStatus: null,
          };
        }
      }
      return { annotations: upsertAnnotation(annotations, annotation), pageStatus: null };
    }

    case "annotation.deleted": {
      const { annotationId } = payload as { annotationId: string };
      return {
        annotations: annotations.filter((item) => item.id !== annotationId),
        pageStatus: null,
      };
    }

    case "comment.created":
    case "comment.updated": {
      const { annotationId, comment } = payload as {
        annotationId: string;
        comment: AnnotationComment;
      };
      if (!annotationId || !comment) {
        return unchanged;
      }
      return {
        annotations: annotations.map((item) =>
          item.id === annotationId
            ? { ...item, comments: upsertComment(item.comments, comment) }
            : item,
        ),
        pageStatus: null,
      };
    }

    case "comment.deleted": {
      const { annotationId, commentId } = payload as {
        annotationId: string;
        commentId: string;
      };
      return {
        annotations: annotations.map((item) =>
          item.id === annotationId
            ? { ...item, comments: item.comments.filter((comment) => comment.id !== commentId) }
            : item,
        ),
        pageStatus: null,
      };
    }

    case "page-status.updated": {
      const { pageStatus } = payload as { pageStatus: { status: PageStatus } };
      return { annotations, pageStatus: pageStatus?.status ?? null };
    }

    default:
      return unchanged;
  }
}

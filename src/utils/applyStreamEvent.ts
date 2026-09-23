import type { Annotation, AnnotationComment, PageStatus } from "../types/annotation.types";
import type { StreamEvent } from "../types/stream.types";
import {
  isAnnotation,
  isComment,
  isNewer,
  normalizeAnnotation,
  upsertById,
} from "./streamPayloadGuards";

function upsertComment(
  comments: AnnotationComment[],
  incoming: AnnotationComment,
): AnnotationComment[] {
  return upsertById(comments, incoming);
}

function upsertAnnotation(annotations: Annotation[], incoming: Annotation): Annotation[] {
  const existing = annotations.find((item) => item.id === incoming.id);
  if (!existing) {
    return [...annotations, incoming].sort((a, b) => a.number - b.number);
  }
  if (!isNewer(incoming.updatedAt, existing.updatedAt)) {
    return annotations;
  }
  return annotations.map((item) =>
    item.id === incoming.id ? { ...incoming, comments: item.comments } : item,
  );
}

export interface StreamApplication {
  annotations: Annotation[];
  pageStatus: PageStatus | null;
}

export function applyStreamEvent(annotations: Annotation[], event: StreamEvent): StreamApplication {
  const unchanged: StreamApplication = { annotations, pageStatus: null };
  const payload = event.payload;
  if (!payload || typeof payload !== "object") {
    return unchanged;
  }

  switch (event.eventType) {
    case "annotation.created":
    case "annotation.updated": {
      const { annotation } = payload as { annotation: unknown };
      if (!annotation || typeof annotation !== "object") {
        return unchanged;
      }
      const candidate = normalizeAnnotation(annotation as Record<string, unknown>);
      if (!isAnnotation(candidate)) {
        return unchanged;
      }
      return { annotations: upsertAnnotation(annotations, candidate), pageStatus: null };
    }

    case "annotation.deleted": {
      const { annotationId } = payload as { annotationId: string };
      if (!annotationId || !annotations.some((item) => item.id === annotationId)) {
        return unchanged;
      }
      return {
        annotations: annotations.filter((item) => item.id !== annotationId),
        pageStatus: null,
      };
    }

    case "comment.created":
    case "comment.updated": {
      const { annotationId, comment } = payload as {
        annotationId: string;
        comment: unknown;
      };
      if (!annotationId || !isComment(comment)) {
        return unchanged;
      }
      const target = annotations.find((item) => item.id === annotationId);
      if (!target) {
        return unchanged;
      }
      const nextComments = upsertComment(target.comments, comment);
      if (nextComments === target.comments) {
        return unchanged;
      }
      return {
        annotations: annotations.map((item) =>
          item.id === annotationId ? { ...item, comments: nextComments } : item,
        ),
        pageStatus: null,
      };
    }

    case "comment.deleted": {
      const { annotationId, commentId } = payload as {
        annotationId: string;
        commentId: string;
      };
      const target = annotations.find((item) => item.id === annotationId);
      if (!target || !target.comments.some((comment) => comment.id === commentId)) {
        return unchanged;
      }
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

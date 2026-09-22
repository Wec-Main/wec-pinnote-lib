import type {
  Annotation,
  AnnotationApiClient,
  AnnotationComment,
  AnnotationUser,
  CreateAnnotationRequest,
  PageStatusRecord,
} from "wec-pinnote-lib";
import { AnnotationApiError } from "wec-pinnote-lib";

const STORAGE_KEY = "wec-pinnote-demo-annotations";
const PAGE_STATUS_STORAGE_KEY = "wec-pinnote-demo-page-status";

function delay(ms = 90): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function createId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function loadStore(): Annotation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Annotation[]) : [];
  } catch {
    return [];
  }
}

function saveStore(items: Annotation[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function pageStatusKey(projectId: string, pageKey: string): string {
  return `${projectId}::${pageKey}`;
}

function loadPageStatuses(): Record<string, PageStatusRecord> {
  try {
    const raw = localStorage.getItem(PAGE_STATUS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, PageStatusRecord>) : {};
  } catch {
    return {};
  }
}

function savePageStatuses(records: Record<string, PageStatusRecord>): void {
  localStorage.setItem(PAGE_STATUS_STORAGE_KEY, JSON.stringify(records));
}

export function createInMemoryAnnotationApi(
  getCurrentUser: () => AnnotationUser,
): AnnotationApiClient {
  let items = loadStore();
  let pageStatuses = loadPageStatuses();

  const persist = () => saveStore(items);
  const persistPageStatuses = () => savePageStatuses(pageStatuses);

  return {
    async listAnnotations({ projectId, pageKey }) {
      await delay();
      return items.filter((item) => item.projectId === projectId && item.pageKey === pageKey);
    },

    async getPageStatus({ projectId, pageKey }) {
      await delay();
      return (
        pageStatuses[pageStatusKey(projectId, pageKey)] ?? {
          projectId,
          pageKey,
          status: "review",
          updatedAt: now(),
        }
      );
    },

    async updatePageStatus(request) {
      await delay();
      const record: PageStatusRecord = {
        projectId: request.projectId,
        pageKey: request.pageKey,
        status: request.status,
        updatedAt: now(),
      };
      pageStatuses = {
        ...pageStatuses,
        [pageStatusKey(request.projectId, request.pageKey)]: record,
      };
      persistPageStatuses();
      return record;
    },

    async getAnnotation(annotationId) {
      await delay();
      const found = items.find((item) => item.id === annotationId);
      if (!found) {
        throw new AnnotationApiError("Annotation not found", 404);
      }
      return found;
    },

    async createAnnotation(request: CreateAnnotationRequest) {
      await delay();
      const createdAt = now();
      const author: AnnotationUser = {
        id: request.comment.authorId ?? getCurrentUser().id,
        name: request.comment.authorName ?? getCurrentUser().name,
      };
      const pageItems = items.filter(
        (item) => item.projectId === request.projectId && item.pageKey === request.pageKey,
      );
      const annotation: Annotation = {
        id: createId(),
        projectId: request.projectId,
        pageKey: request.pageKey,
        number: pageItems.reduce((max, item) => Math.max(max, item.number), 0) + 1,
        anchor: request.anchor,
        status: request.status ?? "open",
        comments: [
          {
            id: createId(),
            message: request.comment.message,
            createdBy: author,
            createdAt,
            updatedAt: createdAt,
          },
        ],
        createdBy: author,
        createdAt,
        updatedAt: createdAt,
      };

      items = [...items, annotation];
      persist();
      return annotation;
    },

    async createComment(annotationId, request) {
      await delay();
      const annotation = items.find((item) => item.id === annotationId);
      if (!annotation) {
        throw new AnnotationApiError("Annotation not found", 404);
      }
      const createdAt = now();
      const comment: AnnotationComment = {
        id: createId(),
        message: request.message,
        createdBy: {
          id: request.authorId ?? getCurrentUser().id,
          name: request.authorName ?? getCurrentUser().name,
        },
        createdAt,
        updatedAt: createdAt,
      };
      annotation.comments = [...annotation.comments, comment];
      annotation.updatedAt = createdAt;
      persist();
      return comment;
    },

    async updateAnnotation(annotationId, request) {
      await delay();
      const annotation = items.find((item) => item.id === annotationId);
      if (!annotation) {
        throw new AnnotationApiError("Annotation not found", 404);
      }
      if (request.status) {
        annotation.status = request.status;
      }
      annotation.updatedAt = now();
      persist();
      return annotation;
    },

    async deleteAnnotation(annotationId) {
      await delay();
      const exists = items.some((item) => item.id === annotationId);
      if (!exists) {
        throw new AnnotationApiError("Annotation not found", 404);
      }
      items = items.filter((item) => item.id !== annotationId);
      persist();
    },

    async updateComment(annotationId, commentId, request) {
      await delay();
      const annotation = items.find((item) => item.id === annotationId);
      const comment = annotation?.comments.find((item) => item.id === commentId);
      if (!annotation || !comment) {
        throw new AnnotationApiError("Comment not found", 404);
      }
      comment.message = request.message;
      comment.updatedAt = now();
      annotation.updatedAt = comment.updatedAt;
      persist();
      return comment;
    },

    async deleteComment(annotationId, commentId) {
      await delay();
      const annotation = items.find((item) => item.id === annotationId);
      if (!annotation) {
        throw new AnnotationApiError("Annotation not found", 404);
      }
      annotation.comments = annotation.comments.filter((item) => item.id !== commentId);
      annotation.updatedAt = now();
      persist();
    },
  };
}

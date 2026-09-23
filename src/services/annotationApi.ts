import {
  AnnotationApiError,
  type Annotation,
  type AnnotationApiClient,
  type AnnotationComment,
  type AnnotationConfig,
  type CreateAnnotationRequest,
  type CreateCommentRequest,
  type PageStatusRecord,
  type UpdateAnnotationRequest,
  type UpdateCommentRequest,
  type UpdatePageStatusRequest,
} from "../types/annotation.types";
import { buildUrl, request, requestNoContent, type QueryValue } from "./httpClient";
import { isAnnotation } from "../utils/streamPayloadGuards";

const PATHS = {
  annotations: "/annotations",
  pageStatus: "/page-status",
  annotation: (id: string) => `/annotations/${encodeURIComponent(id)}`,
  comments: (id: string) => `/annotations/${encodeURIComponent(id)}/comments`,
  comment: (annotationId: string, commentId: string) =>
    `/annotations/${encodeURIComponent(annotationId)}/comments/${encodeURIComponent(commentId)}`,
} as const;

function parseListPayload(payload: unknown): Annotation[] {
  const rawList = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { annotations?: unknown }).annotations)
      ? (payload as { annotations: unknown[] }).annotations
      : null;

  if (!rawList) {
    throw new AnnotationApiError("Unexpected annotations list response", 500);
  }

  return rawList.map((item) => {
    if (!isAnnotation(item)) {
      throw new AnnotationApiError("Unexpected annotation shape in list response", 500);
    }
    return item;
  });
}

export function createAnnotationApi(
  config: Pick<AnnotationConfig, "apiBaseUrl" | "getAuthToken">,
): AnnotationApiClient {
  async function call<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    options: { query?: Record<string, QueryValue>; body?: unknown; signal?: AbortSignal } = {},
  ): Promise<T> {
    const token = config.getAuthToken ? await config.getAuthToken() : undefined;
    const url = buildUrl(config.apiBaseUrl, path, options.query);
    return request<T>(url, token, {
      method,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  }

  async function callNoContent(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    options: { query?: Record<string, QueryValue>; body?: unknown; signal?: AbortSignal } = {},
  ): Promise<void> {
    const token = config.getAuthToken ? await config.getAuthToken() : undefined;
    const url = buildUrl(config.apiBaseUrl, path, options.query);
    return requestNoContent(url, token, {
      method,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  }

  return {
    async listAnnotations({ projectId, pageKey }, signal) {
      const payload = await call<unknown>("GET", PATHS.annotations, {
        query: { projectId, pageKey },
        signal,
      });
      return parseListPayload(payload);
    },

    async getPageStatus({ projectId, pageKey }, signal) {
      try {
        return await call<PageStatusRecord>("GET", PATHS.pageStatus, {
          query: { projectId, pageKey },
          signal,
        });
      } catch (err) {
        if (err instanceof AnnotationApiError && err.status === 404) {
          return {
            projectId,
            pageKey,
            status: "review",
            updatedAt: new Date().toISOString(),
          };
        }
        throw err;
      }
    },

    updatePageStatus(body: UpdatePageStatusRequest, signal) {
      return call<PageStatusRecord>("PATCH", PATHS.pageStatus, { body, signal });
    },

    getAnnotation(annotationId, signal) {
      return call<Annotation>("GET", PATHS.annotation(annotationId), { signal });
    },

    createAnnotation(body: CreateAnnotationRequest, signal) {
      return call<Annotation>("POST", PATHS.annotations, { body, signal });
    },

    createComment(annotationId, body: CreateCommentRequest, signal) {
      return call<AnnotationComment>("POST", PATHS.comments(annotationId), { body, signal });
    },

    updateAnnotation(annotationId, body: UpdateAnnotationRequest, signal) {
      return call<Annotation>("PATCH", PATHS.annotation(annotationId), { body, signal });
    },

    deleteAnnotation(annotationId, signal) {
      return callNoContent("DELETE", PATHS.annotation(annotationId), { signal });
    },

    updateComment(annotationId, commentId, body: UpdateCommentRequest, signal) {
      return call<AnnotationComment>("PATCH", PATHS.comment(annotationId, commentId), {
        body,
        signal,
      });
    },

    deleteComment(annotationId, commentId, signal) {
      return callNoContent("DELETE", PATHS.comment(annotationId, commentId), { signal });
    },
  };
}

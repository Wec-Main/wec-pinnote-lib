import {
  AnnotationApiError,
  type Annotation,
  type AnnotationApiClient,
  type AnnotationComment,
  type AnnotationConfig,
  type CreateAnnotationRequest,
  type CreateCommentRequest,
  type UpdateAnnotationRequest,
  type UpdateCommentRequest,
} from "../types/annotation.types";
import {
  buildUrl,
  request,
  requestNoContent,
  withUnauthorizedRetry,
  type QueryValue,
} from "./httpClient";
import { toAnnotation } from "../utils/streamPayloadGuards";

const PATHS = {
  annotations: "/annotations",
  annotation: (id: string) => `/annotations/${encodeURIComponent(id)}`,
  comments: (id: string) => `/annotations/${encodeURIComponent(id)}/comments`,
  comment: (annotationId: string, commentId: string) =>
    `/annotations/${encodeURIComponent(annotationId)}/comments/${encodeURIComponent(commentId)}`,
} as const;

function parseListPayload(payload: unknown): Annotation[] {
  const rawList = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { annotations?: unknown }).annotations)
      ? (payload as { annotations: unknown[] }).annotations
      : null;

  if (!rawList) {
    throw new AnnotationApiError("Unexpected annotations list response", 500);
  }

  return rawList.reduce<Annotation[]>((accepted, item) => {
    const annotation = toAnnotation(item);
    return annotation ? [...accepted, annotation] : accepted;
  }, []);
}

export function createAnnotationApi(
  config: Pick<AnnotationConfig, "apiBaseUrl" | "getAuthToken">,
): AnnotationApiClient {
  async function call<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    options: { query?: Record<string, QueryValue>; body?: unknown; signal?: AbortSignal } = {},
  ): Promise<T> {
    const url = buildUrl(config.apiBaseUrl, path, options.query);
    return withUnauthorizedRetry(config.getAuthToken, (token) =>
      request<T>(url, token, {
        method,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
      }),
    );
  }

  async function callNoContent(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    options: { query?: Record<string, QueryValue>; body?: unknown; signal?: AbortSignal } = {},
  ): Promise<void> {
    const url = buildUrl(config.apiBaseUrl, path, options.query);
    return withUnauthorizedRetry(config.getAuthToken, (token) =>
      requestNoContent(url, token, {
        method,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
      }),
    );
  }

  return {
    async listAnnotations({ projectId, pageKey, projectVersionId }, signal) {
      const payload = await call<unknown>("GET", PATHS.annotations, {
        query: { projectId, pageKey, projectVersionId },
        signal,
      });
      return parseListPayload(payload);
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

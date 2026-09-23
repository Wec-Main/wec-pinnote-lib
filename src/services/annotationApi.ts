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
import { readErrorMessage, reportUnauthorized } from "./httpClient";

const PATHS = {
  annotations: "/annotations",
  pageStatus: "/page-status",
  annotation: (id: string) => `/annotations/${encodeURIComponent(id)}`,
  comments: (id: string) => `/annotations/${encodeURIComponent(id)}/comments`,
  comment: (annotationId: string, commentId: string) =>
    `/annotations/${encodeURIComponent(annotationId)}/comments/${encodeURIComponent(commentId)}`,
} as const;

interface RequestOptions {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
}

function joinUrl(baseUrl: string, path: string, query?: Record<string, string>): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const url = new URL(`${normalizedBase}${path}`, "http://local.invalid");
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }
  if (/^https?:\/\//i.test(normalizedBase)) {
    return url.toString();
  }
  return `${url.pathname}${url.search}`;
}

function parseListPayload(payload: unknown): Annotation[] {
  if (Array.isArray(payload)) {
    return payload as Annotation[];
  }
  if (payload && typeof payload === "object" && "annotations" in payload) {
    const annotations = (payload as { annotations: unknown }).annotations;
    if (Array.isArray(annotations)) {
      return annotations as Annotation[];
    }
  }
  throw new AnnotationApiError("Unexpected annotations list response", 500);
}

export function createAnnotationApi(
  config: Pick<AnnotationConfig, "apiBaseUrl" | "getAuthToken">,
): AnnotationApiClient {
  async function request<T>(options: RequestOptions): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const token = config.getAuthToken ? await config.getAuthToken() : undefined;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(joinUrl(config.apiBaseUrl, options.path, options.query), {
      method: options.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });

    if (!response.ok) {
      reportUnauthorized(response.status, token);
      const { message, text } = await readErrorMessage(
        response,
        `Annotation API request failed (${response.status})`,
      );
      throw new AnnotationApiError(message, response.status, text || null);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  }

  return {
    async listAnnotations({ projectId, pageKey }, signal) {
      const payload = await request<unknown>({
        method: "GET",
        path: PATHS.annotations,
        query: { projectId, pageKey },
        signal,
      });
      return parseListPayload(payload);
    },

    async getPageStatus({ projectId, pageKey }, signal) {
      try {
        return await request<PageStatusRecord>({
          method: "GET",
          path: PATHS.pageStatus,
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
      return request<PageStatusRecord>({
        method: "PATCH",
        path: PATHS.pageStatus,
        body,
        signal,
      });
    },

    getAnnotation(annotationId, signal) {
      return request<Annotation>({
        method: "GET",
        path: PATHS.annotation(annotationId),
        signal,
      });
    },

    createAnnotation(body: CreateAnnotationRequest, signal) {
      return request<Annotation>({
        method: "POST",
        path: PATHS.annotations,
        body,
        signal,
      });
    },

    createComment(annotationId, body: CreateCommentRequest, signal) {
      return request<AnnotationComment>({
        method: "POST",
        path: PATHS.comments(annotationId),
        body,
        signal,
      });
    },

    updateAnnotation(annotationId, body: UpdateAnnotationRequest, signal) {
      return request<Annotation>({
        method: "PATCH",
        path: PATHS.annotation(annotationId),
        body,
        signal,
      });
    },

    deleteAnnotation(annotationId, signal) {
      return request<void>({
        method: "DELETE",
        path: PATHS.annotation(annotationId),
        signal,
      });
    },

    updateComment(annotationId, commentId, body: UpdateCommentRequest, signal) {
      return request<AnnotationComment>({
        method: "PATCH",
        path: PATHS.comment(annotationId, commentId),
        body,
        signal,
      });
    },

    deleteComment(annotationId, commentId, signal) {
      return request<void>({
        method: "DELETE",
        path: PATHS.comment(annotationId, commentId),
        signal,
      });
    },
  };
}

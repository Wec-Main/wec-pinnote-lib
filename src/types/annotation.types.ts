import type { AuthApiClient } from "./auth.types";
import type { StreamConnectionState } from "./stream.types";

export type AnnotationStatus = "open" | "re-open" | "dev-inprogress" | "completed" | "closed";

export type PageStatus = "review" | "approved";

export interface PageStatusRecord {
  projectId: string;
  pageKey: string;
  status: PageStatus;
  updatedAt: string;
}

export interface UpdatePageStatusRequest {
  projectId: string;
  pageKey: string;
  status: PageStatus;
}

export interface AnnotationUser {
  id: string;
  name: string;
  avatarUrl?: string;
  role?: string;
}

export interface AnnotationAnchor {
  selector: string;
  elementIdentifier: string;
  relativeX: number;
  relativeY: number;
  fallbackX: number;
  fallbackY: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface AnnotationComment {
  id: string;
  message: string;
  createdBy: AnnotationUser;
  createdAt: string;
  updatedAt: string;
}

export interface Annotation {
  id: string;
  projectId: string;
  pageKey: string;
  number: number;
  anchor: AnnotationAnchor;
  status: AnnotationStatus;
  comments: AnnotationComment[];
  createdBy: AnnotationUser;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnnotationRequest {
  projectId: string;
  pageKey: string;
  anchor: AnnotationAnchor;
  comment: {
    message: string;
    authorId?: string;
    authorName?: string;
  };
  status?: AnnotationStatus;
}

export interface CreateCommentRequest {
  message: string;
  authorId?: string;
  authorName?: string;
}

export interface UpdateAnnotationRequest {
  status?: AnnotationStatus;
}

export interface UpdateCommentRequest {
  message: string;
}

export interface AnnotationListResponse {
  annotations: Annotation[];
}

export interface AnnotationApiClient {
  listAnnotations(
    params: { projectId: string; pageKey: string },
    signal?: AbortSignal,
  ): Promise<Annotation[]>;
  getPageStatus(
    params: { projectId: string; pageKey: string },
    signal?: AbortSignal,
  ): Promise<PageStatusRecord>;
  updatePageStatus(
    request: UpdatePageStatusRequest,
    signal?: AbortSignal,
  ): Promise<PageStatusRecord>;
  getAnnotation(annotationId: string, signal?: AbortSignal): Promise<Annotation>;
  createAnnotation(request: CreateAnnotationRequest, signal?: AbortSignal): Promise<Annotation>;
  createComment(
    annotationId: string,
    request: CreateCommentRequest,
    signal?: AbortSignal,
  ): Promise<AnnotationComment>;
  updateAnnotation(
    annotationId: string,
    request: UpdateAnnotationRequest,
    signal?: AbortSignal,
  ): Promise<Annotation>;
  deleteAnnotation(annotationId: string, signal?: AbortSignal): Promise<void>;
  updateComment(
    annotationId: string,
    commentId: string,
    request: UpdateCommentRequest,
    signal?: AbortSignal,
  ): Promise<AnnotationComment>;
  deleteComment(annotationId: string, commentId: string, signal?: AbortSignal): Promise<void>;
}

export interface AnnotationEventCallbacks {
  onAnnotationCreate?: (annotation: Annotation) => void;
  onAnnotationUpdate?: (annotation: Annotation) => void;
  onAnnotationDelete?: (annotationId: string) => void;
  onCommentAdd?: (annotationId: string, comment: AnnotationComment) => void;
  onStatusChange?: (annotationId: string, status: AnnotationStatus) => void;
  onError?: (error: Error) => void;
  onConnectionStateChange?: (state: StreamConnectionState) => void;
}

export interface AnnotationConfig extends AnnotationEventCallbacks {
  apiBaseUrl: string;
  projectId: string;
  currentUser: AnnotationUser;
  getAuthToken?: () => string | Promise<string>;
  getPageKey?: () => string;
  zIndex?: number;
  enabled?: boolean;
  showToggleButton?: boolean;
  showPinsWhenIdle?: boolean;
  showResolved?: boolean;
  apiClient?: AnnotationApiClient;
  authClient?: AuthApiClient;
}

export interface ResolvedAnnotationConfig extends AnnotationConfig {
  zIndex: number;
  enabled: boolean;
  showToggleButton: boolean;
  showPinsWhenIdle: boolean;
  showResolved: boolean;
}

export interface DraftAnnotation {
  id: string;
  label: string;
  anchor: AnnotationAnchor;
  number: number;
  message: string;
}

export class AnnotationApiError extends Error {
  readonly status: number;
  readonly body: string | null;

  constructor(message: string, status: number, body: string | null = null) {
    super(message);
    this.name = "AnnotationApiError";
    this.status = status;
    this.body = body;
  }
}

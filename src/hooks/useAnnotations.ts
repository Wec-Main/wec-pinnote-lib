import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAnnotationData, useAnnotationUi } from "../context/AnnotationContext";
import { useAnnotationStream } from "./useAnnotationStream";
import type { StreamTokenGetter } from "./useSseStream";
import { applyStreamEvent } from "../utils/applyStreamEvent";
import type { StreamEvent } from "../types/stream.types";
import type {
  Annotation,
  AnnotationApiClient,
  AnnotationComment,
  AnnotationEventCallbacks,
  AnnotationStatus,
  AnnotationUser,
  CreateAnnotationRequest,
  UpdateCommentRequest,
} from "../types/annotation.types";
import { AnnotationApiError } from "../types/annotation.types";
import { createClientId } from "../utils/format";

export function nextNumber(annotations: Annotation[]): number {
  return annotations.reduce((max, item) => Math.max(max, item.number), 0) + 1;
}

class StaleAccountError extends Error {
  constructor() {
    super("Account switched before the request resolved");
    this.name = "StaleAccountError";
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof AnnotationApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong";
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(errorMessage(error));
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function replaceTemporary<T extends { id: string }>(items: T[], tempId: string, real: T): T[] {
  if (!items.some((item) => item.id === tempId)) {
    return items;
  }
  return items
    .filter((item) => item.id !== real.id)
    .map((item) => (item.id === tempId ? real : item));
}

function reconcileSnapshot(
  current: Annotation[],
  snapshot: Annotation[],
  pendingAnnotationIds: ReadonlySet<string>,
  pendingCommentIds: ReadonlySet<string>,
): Annotation[] {
  const currentById = new Map(current.map((item) => [item.id, item]));
  const snapshotIds = new Set(snapshot.map((item) => item.id));
  const merged = snapshot.map((item) => {
    const local = currentById.get(item.id);
    if (!local) {
      return item;
    }
    const serverCommentIds = new Set(item.comments.map((comment) => comment.id));
    const pendingComments = local.comments.filter(
      (comment) => pendingCommentIds.has(comment.id) && !serverCommentIds.has(comment.id),
    );
    return pendingComments.length > 0
      ? { ...item, comments: [...item.comments, ...pendingComments] }
      : item;
  });
  const pendingAnnotations = current.filter(
    (item) => pendingAnnotationIds.has(item.id) && !snapshotIds.has(item.id),
  );
  return [...merged, ...pendingAnnotations].sort((a, b) => a.number - b.number);
}

function isFlowPinEvent(event: StreamEvent): boolean {
  return event.eventType.startsWith("flow_pin.");
}

function belongsToOtherVersion(event: StreamEvent, projectVersionId: string | undefined): boolean {
  if (!projectVersionId) {
    return false;
  }
  const annotation = (event.payload as { annotation?: { projectVersionId?: unknown } } | null)
    ?.annotation;
  const eventVersionId = annotation?.projectVersionId;
  return typeof eventVersionId === "string" && eventVersionId !== projectVersionId;
}

interface LoadScope {
  api: AnnotationApiClient;
  authenticated: boolean;
  pageKey: string;
  projectId: string;
  projectVersionId: string | undefined;
  sessionKey: string;
}

function sameScope(previous: LoadScope | null, next: LoadScope): boolean {
  return (
    previous !== null &&
    previous.api === next.api &&
    previous.authenticated === next.authenticated &&
    previous.pageKey === next.pageKey &&
    previous.projectId === next.projectId &&
    previous.projectVersionId === next.projectVersionId &&
    previous.sessionKey === next.sessionKey
  );
}

export interface AnnotationCollectionOptions {
  api: AnnotationApiClient;
  projectId: string;
  projectVersionId?: string;
  pageKey: string;
  currentUser: AnnotationUser;
  authenticated: boolean;
  apiBaseUrl: string;
  getAuthToken: StreamTokenGetter | undefined;
  sessionKey: string;
  events: AnnotationEventCallbacks;
  onFlowPinEvent: (event: StreamEvent) => void;
}

export function useAnnotationCollection({
  api,
  projectId,
  projectVersionId,
  pageKey,
  currentUser,
  authenticated,
  apiBaseUrl,
  getAuthToken,
  sessionKey,
  events,
  onFlowPinEvent,
}: AnnotationCollectionOptions) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(authenticated);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const pendingAnnotationIdsRef = useRef(new Set<string>());
  const pendingCommentIdsRef = useRef(new Set<string>());
  const loadScopeRef = useRef<LoadScope | null>(null);

  const reportError = useCallback((err: unknown) => {
    eventsRef.current.onError?.(toError(err));
  }, []);

  const reportActionError = useCallback(
    (err: unknown) => {
      setActionError(errorMessage(err));
      reportError(err);
    },
    [reportError],
  );

  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;
    const scope: LoadScope = {
      api,
      authenticated,
      pageKey,
      projectId,
      projectVersionId,
      sessionKey,
    };
    const scopeChanged = !sameScope(loadScopeRef.current, scope);
    loadScopeRef.current = scope;

    setError(null);
    if (scopeChanged) {
      setAnnotations([]);
    }

    if (!authenticated) {
      setLoading(false);
      return () => {
        ignore = true;
        controller.abort();
      };
    }

    if (scopeChanged) {
      setLoading(true);
    }

    api
      .listAnnotations({ projectId, pageKey, projectVersionId }, controller.signal)
      .then((items) => {
        if (ignore) {
          return;
        }
        const snapshot = items.filter((item) => item.pageKey === pageKey);
        setAnnotations((current) =>
          reconcileSnapshot(
            current,
            snapshot,
            pendingAnnotationIdsRef.current,
            pendingCommentIdsRef.current,
          ),
        );
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (ignore || isAbortError(err)) {
          return;
        }
        setError(errorMessage(err));
        setLoading(false);
        reportError(err);
      });

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [
    api,
    authenticated,
    pageKey,
    projectId,
    projectVersionId,
    reloadToken,
    reportError,
    sessionKey,
  ]);

  const retry = useCallback(() => {
    setError(null);
    setReloadToken((value) => value + 1);
  }, []);

  const writeControllersRef = useRef(new Set<AbortController>());
  const writeAccountIdRef = useRef(currentUser.id);

  const abortWrites = useCallback(() => {
    const controllers = writeControllersRef.current;
    controllers.forEach((controller) => controller.abort());
    controllers.clear();
  }, []);

  const beginWrite = useCallback(() => {
    const controller = new AbortController();
    writeControllersRef.current.add(controller);
    return controller;
  }, []);

  const endWrite = useCallback((controller: AbortController) => {
    writeControllersRef.current.delete(controller);
  }, []);

  useEffect(() => {
    if (writeAccountIdRef.current !== currentUser.id) {
      writeAccountIdRef.current = currentUser.id;
      abortWrites();
    }
  }, [abortWrites, currentUser.id]);

  useEffect(() => abortWrites, [abortWrites]);

  const projectVersionIdRef = useRef(projectVersionId);
  projectVersionIdRef.current = projectVersionId;

  const onFlowPinEventRef = useRef(onFlowPinEvent);
  onFlowPinEventRef.current = onFlowPinEvent;

  const onStreamEvent = useCallback((event: StreamEvent) => {
    if (isFlowPinEvent(event)) {
      onFlowPinEventRef.current(event);
      return;
    }
    if (belongsToOtherVersion(event, projectVersionIdRef.current)) {
      return;
    }
    setAnnotations((current) => {
      const result = applyStreamEvent(current, event);
      if (result.needsResync) {
        queueMicrotask(() => setReloadToken((value) => value + 1));
      }
      return result.annotations;
    });
  }, []);

  const connectionState = useAnnotationStream({
    apiBaseUrl,
    projectId,
    pageKey,
    getAuthToken,
    sessionKey,
    enabled: authenticated && Boolean(apiBaseUrl),
    onEvent: onStreamEvent,
    onResync: retry,
  });

  useEffect(() => {
    eventsRef.current.onConnectionStateChange?.(connectionState);
  }, [connectionState]);

  const createAnnotation = useCallback(
    async (request: CreateAnnotationRequest) => {
      const tempId = createClientId("temp");
      const now = new Date().toISOString();
      const assignedNumber = nextNumber(annotationsRef.current);
      const requestingUser = currentUserRef.current;
      const optimistic: Annotation = {
        id: tempId,
        projectId: request.projectId,
        projectVersionId: request.projectVersionId,
        pageKey: request.pageKey,
        number: assignedNumber,
        anchor: request.anchor,
        status: request.status ?? "open",
        comments: [
          {
            id: createClientId("comment"),
            message: request.comment.message,
            addToContext: request.comment.addToContext ?? false,
            createdBy: requestingUser,
            createdAt: now,
            updatedAt: now,
          },
        ],
        createdBy: requestingUser,
        createdAt: now,
        updatedAt: now,
      };

      pendingAnnotationIdsRef.current.add(tempId);
      setAnnotations((current) => [...current, optimistic]);
      setActionError(null);
      const controller = beginWrite();

      let created: Annotation;
      try {
        created = await api.createAnnotation(request, controller.signal);
        if (currentUserRef.current.id !== requestingUser.id) {
          throw new StaleAccountError();
        }
      } catch (err) {
        pendingAnnotationIdsRef.current.delete(tempId);
        setAnnotations((current) => current.filter((item) => item.id !== tempId));
        if (err instanceof StaleAccountError || isAbortError(err)) {
          throw new StaleAccountError();
        }
        reportActionError(err);
        throw err;
      } finally {
        endWrite(controller);
      }

      const withLocalIdentity: Annotation = {
        ...created,
        createdBy: requestingUser,
        comments: created.comments.map((comment, index) =>
          index === 0 ? { ...comment, createdBy: requestingUser } : comment,
        ),
      };
      pendingAnnotationIdsRef.current.delete(tempId);
      setAnnotations((current) => replaceTemporary(current, tempId, withLocalIdentity));
      eventsRef.current.onAnnotationCreate?.(withLocalIdentity);
      return withLocalIdentity;
    },
    [api, beginWrite, endWrite, reportActionError],
  );

  const addComment = useCallback(
    async (annotationId: string, message: string, replyToId?: string, addToContext = false) => {
      const tempId = createClientId("comment");
      const now = new Date().toISOString();
      const requestingUser = currentUserRef.current;
      const optimistic: AnnotationComment = {
        id: tempId,
        message,
        replyToId,
        addToContext,
        createdBy: requestingUser,
        createdAt: now,
        updatedAt: now,
      };
      const dropOptimistic = () => {
        pendingCommentIdsRef.current.delete(tempId);
        setAnnotations((current) =>
          current.map((item) =>
            item.id === annotationId
              ? { ...item, comments: item.comments.filter((comment) => comment.id !== tempId) }
              : item,
          ),
        );
      };

      pendingCommentIdsRef.current.add(tempId);
      setAnnotations((current) =>
        current.map((item) =>
          item.id === annotationId
            ? { ...item, comments: [...item.comments, optimistic], updatedAt: now }
            : item,
        ),
      );
      setActionError(null);
      const controller = beginWrite();

      let created: AnnotationComment;
      try {
        created = await api.createComment(
          annotationId,
          {
            message,
            replyToId,
            addToContext,
            authorId: requestingUser.id,
          },
          controller.signal,
        );
      } catch (err) {
        dropOptimistic();
        if (isAbortError(err)) {
          return;
        }
        reportActionError(err);
        throw err;
      } finally {
        endWrite(controller);
      }

      if (currentUserRef.current.id !== requestingUser.id) {
        dropOptimistic();
        return;
      }
      const withLocalIdentity: AnnotationComment = { ...created, createdBy: requestingUser };
      pendingCommentIdsRef.current.delete(tempId);
      const parentPresent = annotationsRef.current.some((item) => item.id === annotationId);
      setAnnotations((current) =>
        current.map((item) =>
          item.id === annotationId
            ? { ...item, comments: replaceTemporary(item.comments, tempId, withLocalIdentity) }
            : item,
        ),
      );
      if (!parentPresent) {
        retry();
        return;
      }
      eventsRef.current.onCommentAdd?.(annotationId, withLocalIdentity);
    },
    [api, beginWrite, endWrite, reportActionError, retry],
  );

  const patchComment = useCallback(
    async (annotationId: string, commentId: string, patch: UpdateCommentRequest) => {
      const previous = annotationsRef.current
        .find((item) => item.id === annotationId)
        ?.comments.find((comment) => comment.id === commentId);
      const now = new Date().toISOString();
      setAnnotations((current) =>
        current.map((item) =>
          item.id === annotationId
            ? {
                ...item,
                comments: item.comments.map((comment) =>
                  comment.id === commentId ? { ...comment, ...patch, updatedAt: now } : comment,
                ),
              }
            : item,
        ),
      );
      setActionError(null);
      const requestingUser = currentUserRef.current;
      const controller = beginWrite();

      try {
        const updated = await api.updateComment(annotationId, commentId, patch, controller.signal);
        if (currentUserRef.current.id !== requestingUser.id) {
          return;
        }
        setAnnotations((current) =>
          current.map((item) =>
            item.id === annotationId
              ? {
                  ...item,
                  comments: item.comments.map((comment) =>
                    comment.id === commentId ? updated : comment,
                  ),
                }
              : item,
          ),
        );
      } catch (err) {
        if (isAbortError(err)) {
          return;
        }
        if (previous) {
          const restored = previous;
          setAnnotations((current) =>
            current.map((item) =>
              item.id === annotationId
                ? {
                    ...item,
                    comments: item.comments.map((comment) =>
                      comment.id === commentId ? restored : comment,
                    ),
                  }
                : item,
            ),
          );
        }
        reportActionError(err);
        throw err;
      } finally {
        endWrite(controller);
      }
    },
    [api, beginWrite, endWrite, reportActionError],
  );

  const editComment = useCallback(
    (annotationId: string, commentId: string, message: string) =>
      patchComment(annotationId, commentId, { message }),
    [patchComment],
  );

  const setCommentAddToContext = useCallback(
    (annotationId: string, commentId: string, addToContext: boolean) =>
      patchComment(annotationId, commentId, { addToContext }),
    [patchComment],
  );

  const removeAnnotation = useCallback(
    async (annotationId: string) => {
      const removed = annotationsRef.current.find((item) => item.id === annotationId);
      setAnnotations((current) => current.filter((item) => item.id !== annotationId));
      setActionError(null);
      const controller = beginWrite();

      try {
        await api.deleteAnnotation(annotationId, controller.signal);
      } catch (err) {
        if (isAbortError(err)) {
          return;
        }
        if (removed) {
          const restored = removed;
          setAnnotations((current) => [...current, restored].sort((a, b) => a.number - b.number));
        }
        reportActionError(err);
        throw err;
      } finally {
        endWrite(controller);
      }
      eventsRef.current.onAnnotationDelete?.(annotationId);
    },
    [api, beginWrite, endWrite, reportActionError],
  );

  const removeComment = useCallback(
    async (annotationId: string, commentId: string) => {
      const commentsBefore =
        annotationsRef.current.find((item) => item.id === annotationId)?.comments ?? [];
      const removedIndex = commentsBefore.findIndex((comment) => comment.id === commentId);
      const removed = removedIndex >= 0 ? commentsBefore[removedIndex] : undefined;
      const remainingCount = commentsBefore.length - (removed ? 1 : 0);
      setAnnotations((current) =>
        current.map((item) =>
          item.id === annotationId
            ? { ...item, comments: item.comments.filter((comment) => comment.id !== commentId) }
            : item,
        ),
      );
      setActionError(null);
      const controller = beginWrite();

      try {
        await api.deleteComment(annotationId, commentId, controller.signal);
      } catch (err) {
        if (isAbortError(err)) {
          return;
        }
        if (removed) {
          const restored = removed;
          setAnnotations((current) =>
            current.map((item) =>
              item.id === annotationId &&
              !item.comments.some((comment) => comment.id === restored.id)
                ? {
                    ...item,
                    comments: [
                      ...item.comments.slice(0, removedIndex),
                      restored,
                      ...item.comments.slice(removedIndex),
                    ],
                  }
                : item,
            ),
          );
        }
        reportActionError(err);
        throw err;
      } finally {
        endWrite(controller);
      }

      if (removed && remainingCount === 0) {
        await removeAnnotation(annotationId);
      }
    },
    [api, beginWrite, endWrite, removeAnnotation, reportActionError],
  );

  const setStatus = useCallback(
    async (annotationId: string, status: AnnotationStatus) => {
      const previousStatus = annotationsRef.current.find(
        (item) => item.id === annotationId,
      )?.status;
      setAnnotations((current) =>
        current.map((item) => (item.id === annotationId ? { ...item, status } : item)),
      );
      setActionError(null);
      const requestingUser = currentUserRef.current;
      const controller = beginWrite();

      let updated: Annotation;
      try {
        updated = await api.updateAnnotation(annotationId, { status }, controller.signal);
        if (currentUserRef.current.id !== requestingUser.id) {
          return;
        }
      } catch (err) {
        if (isAbortError(err)) {
          return;
        }
        if (previousStatus) {
          const restored = previousStatus;
          setAnnotations((current) =>
            current.map((item) =>
              item.id === annotationId ? { ...item, status: restored } : item,
            ),
          );
        }
        reportActionError(err);
        throw err;
      } finally {
        endWrite(controller);
      }
      setAnnotations((current) =>
        current.map((item) => (item.id === annotationId ? updated : item)),
      );
      eventsRef.current.onStatusChange?.(annotationId, updated.status);
      eventsRef.current.onAnnotationUpdate?.(updated);
    },
    [api, beginWrite, endWrite, reportActionError],
  );

  const renameAnnotation = useCallback(
    async (annotationId: string, path: string) => {
      const previousPath = annotationsRef.current.find((item) => item.id === annotationId)?.path;
      setAnnotations((current) =>
        current.map((item) => (item.id === annotationId ? { ...item, path } : item)),
      );
      setActionError(null);
      const requestingUser = currentUserRef.current;
      const controller = beginWrite();

      let updated: Annotation;
      try {
        updated = await api.updateAnnotation(annotationId, { path }, controller.signal);
        if (currentUserRef.current.id !== requestingUser.id) {
          return;
        }
      } catch (err) {
        if (isAbortError(err)) {
          return;
        }
        setAnnotations((current) =>
          current.map((item) =>
            item.id === annotationId ? { ...item, path: previousPath } : item,
          ),
        );
        reportActionError(err);
        throw err;
      } finally {
        endWrite(controller);
      }
      setAnnotations((current) =>
        current.map((item) => (item.id === annotationId ? updated : item)),
      );
      eventsRef.current.onAnnotationUpdate?.(updated);
    },
    [api, beginWrite, endWrite, reportActionError],
  );

  const clearActionError = useCallback(() => setActionError(null), []);

  return useMemo(
    () => ({
      annotations,
      loading,
      error,
      connectionState,
      actionError,
      clearActionError,
      retry,
      createAnnotation,
      addComment,
      editComment,
      setCommentAddToContext,
      removeComment,
      setStatus,
      renameAnnotation,
      removeAnnotation,
    }),
    [
      annotations,
      loading,
      error,
      connectionState,
      actionError,
      clearActionError,
      retry,
      createAnnotation,
      addComment,
      editComment,
      setCommentAddToContext,
      removeComment,
      setStatus,
      renameAnnotation,
      removeAnnotation,
    ],
  );
}

export function useAnnotations() {
  const data = useAnnotationData();
  const { selectedId, selectAnnotation } = useAnnotationUi();
  return useMemo(
    () => ({
      annotations: data.annotations,
      loading: data.loading,
      error: data.error,
      retry: data.retry,
      actionError: data.actionError,
      clearActionError: data.clearActionError,
      selectedId,
      selectAnnotation,
      createAnnotation: data.createAnnotation,
      addComment: data.addComment,
      editComment: data.editComment,
      setCommentAddToContext: data.setCommentAddToContext,
      removeComment: data.removeComment,
      setStatus: data.setStatus,
      renameAnnotation: data.renameAnnotation,
      removeAnnotation: data.removeAnnotation,
      pageKey: data.pageKey,
      connectionState: data.connectionState,
    }),
    [
      data.annotations,
      data.loading,
      data.error,
      data.retry,
      data.actionError,
      data.clearActionError,
      selectedId,
      selectAnnotation,
      data.createAnnotation,
      data.addComment,
      data.editComment,
      data.setCommentAddToContext,
      data.removeComment,
      data.setStatus,
      data.renameAnnotation,
      data.removeAnnotation,
      data.pageKey,
      data.connectionState,
    ],
  );
}

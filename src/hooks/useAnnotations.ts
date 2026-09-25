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
} from "../types/annotation.types";
import { AnnotationApiError } from "../types/annotation.types";
import { createClientId } from "../utils/format";

function nextNumber(annotations: Annotation[]): number {
  return annotations.reduce((max, item) => Math.max(max, item.number), 0) + 1;
}

class StaleAccountError extends Error {
  constructor() {
    super("Account switched before the request resolved");
    this.name = "StaleAccountError";
  }
}

function errorMessage(error: unknown): string {
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

interface LoadScope {
  api: AnnotationApiClient;
  authenticated: boolean;
  pageKey: string;
  projectId: string;
  sessionKey: string;
}

function sameScope(previous: LoadScope | null, next: LoadScope): boolean {
  return (
    previous !== null &&
    previous.api === next.api &&
    previous.authenticated === next.authenticated &&
    previous.pageKey === next.pageKey &&
    previous.projectId === next.projectId &&
    previous.sessionKey === next.sessionKey
  );
}

export interface AnnotationCollectionOptions {
  api: AnnotationApiClient;
  projectId: string;
  pageKey: string;
  currentUser: AnnotationUser;
  authenticated: boolean;
  apiBaseUrl: string;
  getAuthToken: StreamTokenGetter | undefined;
  sessionKey: string;
  events: AnnotationEventCallbacks;
}

export function useAnnotationCollection({
  api,
  projectId,
  pageKey,
  currentUser,
  authenticated,
  apiBaseUrl,
  getAuthToken,
  sessionKey,
  events,
}: AnnotationCollectionOptions) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(authenticated);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const annotationsRef = useRef(annotations);
  const currentUserRef = useRef(currentUser);
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const pendingAnnotationIdsRef = useRef(new Set<string>());
  const pendingCommentIdsRef = useRef(new Set<string>());
  const loadScopeRef = useRef<LoadScope | null>(null);

  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

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
    const scope: LoadScope = { api, authenticated, pageKey, projectId, sessionKey };
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
      .listAnnotations({ projectId, pageKey }, controller.signal)
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
  }, [api, authenticated, pageKey, projectId, reloadToken, reportError, sessionKey]);

  const retry = useCallback(() => {
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

  const onStreamEvent = useCallback((event: StreamEvent) => {
    setAnnotations((current) => applyStreamEvent(current, event).annotations);
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
        pageKey: request.pageKey,
        number: assignedNumber,
        anchor: request.anchor,
        status: request.status ?? "open",
        comments: [
          {
            id: createClientId("comment"),
            message: request.comment.message,
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
    async (annotationId: string, message: string) => {
      const tempId = createClientId("comment");
      const now = new Date().toISOString();
      const requestingUser = currentUserRef.current;
      const optimistic: AnnotationComment = {
        id: tempId,
        message,
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
      setAnnotations((current) =>
        current.map((item) =>
          item.id === annotationId
            ? { ...item, comments: replaceTemporary(item.comments, tempId, withLocalIdentity) }
            : item,
        ),
      );
      eventsRef.current.onCommentAdd?.(annotationId, withLocalIdentity);
    },
    [api, beginWrite, endWrite, reportActionError],
  );

  const editComment = useCallback(
    async (annotationId: string, commentId: string, message: string) => {
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
                  comment.id === commentId ? { ...comment, message, updatedAt: now } : comment,
                ),
              }
            : item,
        ),
      );
      setActionError(null);

      try {
        const updated = await api.updateComment(annotationId, commentId, { message });
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
      }
    },
    [api, reportActionError],
  );

  const removeComment = useCallback(
    async (annotationId: string, commentId: string) => {
      const commentsBefore =
        annotationsRef.current.find((item) => item.id === annotationId)?.comments ?? [];
      const removedIndex = commentsBefore.findIndex((comment) => comment.id === commentId);
      const removed = removedIndex >= 0 ? commentsBefore[removedIndex] : undefined;
      setAnnotations((current) =>
        current.map((item) =>
          item.id === annotationId
            ? { ...item, comments: item.comments.filter((comment) => comment.id !== commentId) }
            : item,
        ),
      );
      setActionError(null);

      try {
        await api.deleteComment(annotationId, commentId);
      } catch (err) {
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
      }
    },
    [api, reportActionError],
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

      let updated: Annotation;
      try {
        updated = await api.updateAnnotation(annotationId, { status });
      } catch (err) {
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
      }
      setAnnotations((current) =>
        current.map((item) => (item.id === annotationId ? updated : item)),
      );
      eventsRef.current.onStatusChange?.(annotationId, updated.status);
      eventsRef.current.onAnnotationUpdate?.(updated);
    },
    [api, reportActionError],
  );

  const removeAnnotation = useCallback(
    async (annotationId: string) => {
      const removed = annotationsRef.current.find((item) => item.id === annotationId);
      setAnnotations((current) => current.filter((item) => item.id !== annotationId));
      setActionError(null);

      try {
        await api.deleteAnnotation(annotationId);
      } catch (err) {
        if (removed) {
          const restored = removed;
          setAnnotations((current) => [...current, restored].sort((a, b) => a.number - b.number));
        }
        reportActionError(err);
        throw err;
      }
      eventsRef.current.onAnnotationDelete?.(annotationId);
    },
    [api, reportActionError],
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
      removeComment,
      setStatus,
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
      removeComment,
      setStatus,
      removeAnnotation,
    ],
  );
}

export function useAnnotations() {
  const data = useAnnotationData();
  const { selectedId, selectAnnotation } = useAnnotationUi();
  return {
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
    removeComment: data.removeComment,
    setStatus: data.setStatus,
    removeAnnotation: data.removeAnnotation,
    pageKey: data.pageKey,
    connectionState: data.connectionState,
  };
}

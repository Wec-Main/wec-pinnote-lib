import { useCallback, useEffect, useRef, useState } from "react";
import { useAnnotationData, useAnnotationUi } from "../context/AnnotationContext";
import { useAnnotationStream } from "./useAnnotationStream";
import { applyStreamEvent } from "../utils/applyStreamEvent";
import type { StreamEvent } from "../types/stream.types";
import type {
  Annotation,
  AnnotationApiClient,
  AnnotationComment,
  AnnotationStatus,
  AnnotationUser,
  CreateAnnotationRequest,
  PageStatus,
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

export function useAnnotationCollection(
  api: AnnotationApiClient,
  projectId: string,
  pageKey: string,
  currentUser: AnnotationUser,
  authenticated: boolean,
  streamBaseUrl?: string,
  streamAuthToken?: string,
) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [pageStatus, setPageStatusState] = useState<PageStatus>("review");
  const [loading, setLoading] = useState(authenticated);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const annotationsRef = useRef(annotations);
  const currentUserRef = useRef(currentUser);

  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;

    setError(null);
    setAnnotations([]);
    setPageStatusState("review");

    if (!authenticated) {
      setLoading(false);
      return () => {
        ignore = true;
        controller.abort();
      };
    }

    setLoading(true);

    api
      .listAnnotations({ projectId, pageKey }, controller.signal)
      .then((items) => {
        if (!ignore) {
          setAnnotations(items.filter((item) => item.pageKey === pageKey));
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (ignore || (err instanceof DOMException && err.name === "AbortError")) {
          return;
        }
        setError(errorMessage(err));
        setLoading(false);
      });

    api
      .getPageStatus({ projectId, pageKey }, controller.signal)
      .then((record) => {
        if (!ignore) {
          setPageStatusState(record.status);
        }
      })
      .catch((err: unknown) => {
        if (ignore || (err instanceof DOMException && err.name === "AbortError")) {
          return;
        }
        setPageStatusState("review");
      });

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [api, authenticated, pageKey, projectId, reloadToken]);

  const retry = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  const writeControllerRef = useRef<AbortController | null>(null);
  const writeAccountIdRef = useRef(currentUser.id);

  useEffect(() => {
    if (writeAccountIdRef.current !== currentUser.id) {
      writeAccountIdRef.current = currentUser.id;
      writeControllerRef.current?.abort();
      writeControllerRef.current = null;
    }
  }, [currentUser.id]);

  const onStreamEvent = useCallback((event: StreamEvent) => {
    const result = applyStreamEvent(annotationsRef.current, event);
    if (result.annotations !== annotationsRef.current) {
      setAnnotations(result.annotations);
    }
    if (result.pageStatus) {
      setPageStatusState(result.pageStatus);
    }
  }, []);

  const connectionState = useAnnotationStream({
    apiBaseUrl: streamBaseUrl ?? "",
    projectId,
    pageKey,
    authToken: streamAuthToken,
    enabled: authenticated && Boolean(streamBaseUrl),
    onEvent: onStreamEvent,
    onResync: retry,
  });

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

      setAnnotations((current) => [...current, optimistic]);
      setActionError(null);

      writeControllerRef.current?.abort();
      const controller = new AbortController();
      writeControllerRef.current = controller;

      try {
        const created = await api.createAnnotation(request, controller.signal);
        if (currentUserRef.current.id !== requestingUser.id) {
          setAnnotations((current) => current.filter((item) => item.id !== tempId));
          throw new StaleAccountError();
        }
        const withLocalIdentity: Annotation = {
          ...created,
          createdBy: requestingUser,
          comments: created.comments.map((comment, index) =>
            index === 0 ? { ...comment, createdBy: requestingUser } : comment,
          ),
        };
        setAnnotations((current) =>
          current.map((item) => (item.id === tempId ? withLocalIdentity : item)),
        );
        return withLocalIdentity;
      } catch (err) {
        setAnnotations((current) => current.filter((item) => item.id !== tempId));
        if (err instanceof StaleAccountError) {
          throw err;
        }
        if (err instanceof DOMException && err.name === "AbortError") {
          throw new StaleAccountError();
        }
        setActionError(errorMessage(err));
        throw err;
      }
    },
    [api],
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

      setAnnotations((current) =>
        current.map((item) =>
          item.id === annotationId
            ? { ...item, comments: [...item.comments, optimistic], updatedAt: now }
            : item,
        ),
      );
      setActionError(null);

      writeControllerRef.current?.abort();
      const controller = new AbortController();
      writeControllerRef.current = controller;

      try {
        const created = await api.createComment(
          annotationId,
          {
            message,
            authorId: requestingUser.id,
            authorName: requestingUser.name,
          },
          controller.signal,
        );
        if (currentUserRef.current.id !== requestingUser.id) {
          setAnnotations((current) =>
            current.map((item) =>
              item.id === annotationId
                ? { ...item, comments: item.comments.filter((comment) => comment.id !== tempId) }
                : item,
            ),
          );
          return;
        }
        const withLocalIdentity: AnnotationComment = { ...created, createdBy: requestingUser };
        setAnnotations((current) =>
          current.map((item) =>
            item.id === annotationId
              ? {
                  ...item,
                  comments: item.comments.map((comment) =>
                    comment.id === tempId ? withLocalIdentity : comment,
                  ),
                }
              : item,
          ),
        );
      } catch (err) {
        setAnnotations((current) =>
          current.map((item) =>
            item.id === annotationId
              ? { ...item, comments: item.comments.filter((comment) => comment.id !== tempId) }
              : item,
          ),
        );
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setActionError(errorMessage(err));
        throw err;
      }
    },
    [api],
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
        setActionError(errorMessage(err));
        throw err;
      }
    },
    [api],
  );

  const removeComment = useCallback(
    async (annotationId: string, commentId: string) => {
      const removed = annotationsRef.current
        .find((item) => item.id === annotationId)
        ?.comments.find((comment) => comment.id === commentId);
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
              item.id === annotationId ? { ...item, comments: [...item.comments, restored] } : item,
            ),
          );
        }
        setActionError(errorMessage(err));
        throw err;
      }
    },
    [api],
  );

  const setPageStatus = useCallback(
    async (status: PageStatus) => {
      const snapshot = pageStatus;
      setPageStatusState(status);
      setActionError(null);

      try {
        const updated = await api.updatePageStatus({ projectId, pageKey, status });
        setPageStatusState(updated.status);
      } catch (err) {
        setPageStatusState(snapshot);
        setActionError(errorMessage(err));
        throw err;
      }
    },
    [api, pageKey, pageStatus, projectId],
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

      try {
        const updated = await api.updateAnnotation(annotationId, { status });
        setAnnotations((current) =>
          current.map((item) => (item.id === annotationId ? updated : item)),
        );
      } catch (err) {
        if (previousStatus) {
          const restored = previousStatus;
          setAnnotations((current) =>
            current.map((item) =>
              item.id === annotationId ? { ...item, status: restored } : item,
            ),
          );
        }
        setActionError(errorMessage(err));
        throw err;
      }
    },
    [api],
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
        setActionError(errorMessage(err));
        throw err;
      }
    },
    [api],
  );

  const clearActionError = useCallback(() => setActionError(null), []);

  return {
    annotations,
    pageStatus,
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
    setPageStatus,
    setStatus,
    removeAnnotation,
  };
}

export function useAnnotations() {
  const data = useAnnotationData();
  const { selectedId, selectAnnotation } = useAnnotationUi();
  return {
    annotations: data.annotations,
    pageStatus: data.pageStatus,
    loading: data.loading,
    error: data.error,
    retry: data.retry,
    selectedId,
    selectAnnotation,
    addComment: data.addComment,
    editComment: data.editComment,
    removeComment: data.removeComment,
    setPageStatus: data.setPageStatus,
    setStatus: data.setStatus,
    removeAnnotation: data.removeAnnotation,
    pageKey: data.pageKey,
    connectionState: data.connectionState,
  };
}

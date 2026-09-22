import { useCallback, useEffect, useState } from "react";
import { useAnnotationContext } from "../context/AnnotationContext";
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
  streamBaseUrl?: string,
) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [pageStatus, setPageStatusState] = useState<PageStatus>("review");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;

    setLoading(true);
    setError(null);
    setAnnotations([]);
    setPageStatusState("review");

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
  }, [api, pageKey, projectId, reloadToken]);

  const retry = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  const onStreamEvent = useCallback((event: StreamEvent) => {
    setAnnotations((current) => {
      const result = applyStreamEvent(current, event);
      if (result.pageStatus) {
        setPageStatusState(result.pageStatus);
      }
      return result.annotations;
    });
  }, []);

  const connectionState = useAnnotationStream({
    apiBaseUrl: streamBaseUrl ?? "",
    projectId,
    pageKey,
    enabled: Boolean(streamBaseUrl),
    onEvent: onStreamEvent,
    onResync: retry,
  });

  const createAnnotation = useCallback(
    async (request: CreateAnnotationRequest) => {
      const tempId = createClientId("temp");
      const now = new Date().toISOString();
      let assignedNumber = 1;
      setAnnotations((current) => {
        assignedNumber = nextNumber(current);
        return current;
      });
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
            createdBy: currentUser,
            createdAt: now,
            updatedAt: now,
          },
        ],
        createdBy: currentUser,
        createdAt: now,
        updatedAt: now,
      };

      setAnnotations((current) => [...current, optimistic]);
      setActionError(null);

      try {
        const created = await api.createAnnotation(request);
        const withLocalIdentity: Annotation = {
          ...created,
          createdBy: currentUser,
          comments: created.comments.map((comment, index) =>
            index === 0 ? { ...comment, createdBy: currentUser } : comment,
          ),
        };
        setAnnotations((current) =>
          current.map((item) => (item.id === tempId ? withLocalIdentity : item)),
        );
        return withLocalIdentity;
      } catch (err) {
        setAnnotations((current) => current.filter((item) => item.id !== tempId));
        setActionError(errorMessage(err));
        throw err;
      }
    },
    [api, currentUser],
  );

  const addComment = useCallback(
    async (annotationId: string, message: string) => {
      const tempId = createClientId("comment");
      const now = new Date().toISOString();
      const optimistic: AnnotationComment = {
        id: tempId,
        message,
        createdBy: currentUser,
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

      try {
        const created = await api.createComment(annotationId, {
          message,
          authorId: currentUser.id,
          authorName: currentUser.name,
        });
        const withLocalIdentity: AnnotationComment = { ...created, createdBy: currentUser };
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
        setActionError(errorMessage(err));
        throw err;
      }
    },
    [api, currentUser],
  );

  const editComment = useCallback(
    async (annotationId: string, commentId: string, message: string) => {
      let previous: AnnotationComment | undefined;
      setAnnotations((current) => {
        previous = current
          .find((item) => item.id === annotationId)
          ?.comments.find((comment) => comment.id === commentId);
        return current;
      });
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
      let removed: AnnotationComment | undefined;
      setAnnotations((current) => {
        removed = current
          .find((item) => item.id === annotationId)
          ?.comments.find((comment) => comment.id === commentId);
        return current;
      });
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
              item.id === annotationId
                ? { ...item, comments: [...item.comments, restored] }
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
      let previousStatus: AnnotationStatus | undefined;
      setAnnotations((current) => {
        previousStatus = current.find((item) => item.id === annotationId)?.status;
        return current;
      });
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
      let removed: Annotation | undefined;
      setAnnotations((current) => {
        removed = current.find((item) => item.id === annotationId);
        return current;
      });
      setAnnotations((current) => current.filter((item) => item.id !== annotationId));
      setActionError(null);

      try {
        await api.deleteAnnotation(annotationId);
      } catch (err) {
        if (removed) {
          const restored = removed;
          setAnnotations((current) =>
            [...current, restored].sort((a, b) => a.number - b.number),
          );
        }
        setActionError(errorMessage(err));
        throw err;
      }
    },
    [api],
  );

  return {
    annotations,
    pageStatus,
    loading,
    error,
    connectionState,
    actionError,
    clearActionError: () => setActionError(null),
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
  const context = useAnnotationContext();
  return {
    annotations: context.annotations,
    pageStatus: context.pageStatus,
    loading: context.loading,
    error: context.error,
    retry: context.retry,
    selectedId: context.selectedId,
    selectAnnotation: context.selectAnnotation,
    addComment: context.addComment,
    editComment: context.editComment,
    removeComment: context.removeComment,
    setPageStatus: context.setPageStatus,
    setStatus: context.setStatus,
    removeAnnotation: context.removeAnnotation,
    pageKey: context.pageKey,
    connectionState: context.connectionState,
  };
}

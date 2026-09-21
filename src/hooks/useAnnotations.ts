import { useCallback, useEffect, useState } from "react";
import { useAnnotationContext } from "../context/AnnotationContext";
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

  const createAnnotation = useCallback(
    async (request: CreateAnnotationRequest) => {
      const tempId = createClientId("temp");
      const now = new Date().toISOString();
      const optimistic: Annotation = {
        id: tempId,
        projectId: request.projectId,
        pageKey: request.pageKey,
        number: nextNumber(annotations),
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
    [annotations, api, currentUser],
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
      const snapshot = annotations;
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
        setAnnotations(snapshot);
        setActionError(errorMessage(err));
        throw err;
      }
    },
    [annotations, api],
  );

  const removeComment = useCallback(
    async (annotationId: string, commentId: string) => {
      const snapshot = annotations;
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
        setAnnotations(snapshot);
        setActionError(errorMessage(err));
        throw err;
      }
    },
    [annotations, api],
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
      const snapshot = annotations;
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
        setAnnotations(snapshot);
        setActionError(errorMessage(err));
        throw err;
      }
    },
    [annotations, api],
  );

  const removeAnnotation = useCallback(
    async (annotationId: string) => {
      const snapshot = annotations;
      setAnnotations((current) => current.filter((item) => item.id !== annotationId));
      setActionError(null);

      try {
        await api.deleteAnnotation(annotationId);
      } catch (err) {
        setAnnotations(snapshot);
        setActionError(errorMessage(err));
        throw err;
      }
    },
    [annotations, api],
  );

  return {
    annotations,
    pageStatus,
    loading,
    error,
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
  };
}

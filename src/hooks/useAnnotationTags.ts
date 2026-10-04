import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createAnnotationTag,
  deleteAnnotationTag,
  fetchAnnotationTags,
  fetchPreferences,
  saveTagsVisible,
  updateAnnotationTag,
} from "../services/annotationTagsService";
import type {
  AnnotationTag,
  DraftTagPin,
  UpdateAnnotationTagInput,
} from "../types/annotationTag.types";
import type { AnnotationAnchor } from "../types/annotation.types";
import { createClientId } from "../utils/format";
import { useTokenGetter } from "./useTokenGetter";
import { usePageScopedResource } from "./usePageScopedResource";

const LOAD_ERROR_MESSAGE = "Could not load tags for this page";

interface UseAnnotationTagsOptions {
  apiBaseUrl: string;
  projectId: string;
  projectVersionId?: string;
  pageKey: string;
  getAuthToken: (() => string | Promise<string>) | undefined;
  sessionKey: string | null;
  enabled: boolean;
}

export interface AnnotationTagsState {
  annotationTags: AnnotationTag[];
  annotationTagsError: string | null;
  tagsVisible: boolean;
  setTagsVisible: (visible: boolean) => void;
  tagModeEnabled: boolean;
  setTagModeEnabled: (enabled: boolean) => void;
  tagDraft: DraftTagPin | null;
  startTagDraft: (anchor: AnnotationAnchor, label: string) => void;
  cancelTagDraft: () => void;
  submitTagDraft: (tagId: string) => Promise<void>;
  removeAnnotationTag: (annotationTagId: string) => Promise<void>;
  reloadAnnotationTags: () => void;
  applyAnnotationTagLocal: (annotationTagId: string, patch: Partial<AnnotationTag>) => void;
  commitAnnotationTagUpdate: (
    annotationTagId: string,
    input: UpdateAnnotationTagInput,
  ) => Promise<void>;
}

export function useAnnotationTags(options: UseAnnotationTagsOptions): AnnotationTagsState {
  const { apiBaseUrl, projectId, projectVersionId, pageKey, getAuthToken, sessionKey, enabled } =
    options;
  const getToken = useTokenGetter(getAuthToken);
  const [tagsVisible, setTagsVisibleState] = useState(true);
  const [tagModeEnabled, setTagModeEnabled] = useState(false);
  const [tagDraft, setTagDraft] = useState<DraftTagPin | null>(null);
  const tagsVisibleRef = useRef(tagsVisible);
  tagsVisibleRef.current = tagsVisible;

  const {
    items: annotationTags,
    setItems: setAnnotationTags,
    itemsRef: annotationTagsRef,
    error: annotationTagsError,
    reload: reloadAnnotationTags,
  } = usePageScopedResource<AnnotationTag>({
    apiBaseUrl,
    getToken,
    projectId,
    projectVersionId,
    pageKey,
    sessionKey,
    enabled,
    fetchItems: fetchAnnotationTags,
    loadErrorMessage: LOAD_ERROR_MESSAGE,
    onScopeChange: () => setTagDraft(null),
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const controller = new AbortController();
    getToken()
      .then((token) => fetchPreferences(apiBaseUrl, token, projectId, controller.signal))
      .then((preferences) => setTagsVisibleState(preferences.tagsVisible))
      .catch(() => undefined);
    return () => controller.abort();
  }, [apiBaseUrl, getToken, sessionKey, projectId, enabled]);

  const setTagsVisible = useCallback(
    (visible: boolean) => {
      const previous = tagsVisibleRef.current;
      setTagsVisibleState(visible);
      getToken()
        .then((token) => saveTagsVisible(apiBaseUrl, token, projectId, visible))
        .catch(() => setTagsVisibleState((current) => (current === visible ? previous : current)));
    },
    [apiBaseUrl, getToken, projectId],
  );

  const startTagDraft = useCallback((anchor: AnnotationAnchor, label: string) => {
    setTagDraft({ id: createClientId("wpn-tag-draft"), anchor, label });
  }, []);

  const cancelTagDraft = useCallback(() => setTagDraft(null), []);

  const submitTagDraft = useCallback(
    async (tagId: string) => {
      if (!tagDraft) {
        return;
      }
      const created = await createAnnotationTag(apiBaseUrl, await getToken(), {
        projectId,
        projectVersionId,
        pageKey,
        tagId,
        anchor: tagDraft.anchor,
      });
      setAnnotationTags((current) => [created, ...current]);
      setTagDraft(null);
      setTagModeEnabled(false);
      if (!tagsVisibleRef.current) {
        setTagsVisible(true);
      }
    },
    [
      apiBaseUrl,
      getToken,
      projectId,
      projectVersionId,
      pageKey,
      tagDraft,
      setAnnotationTags,
      setTagsVisible,
    ],
  );

  const removeAnnotationTag = useCallback(
    async (annotationTagId: string) => {
      await deleteAnnotationTag(apiBaseUrl, await getToken(), annotationTagId);
      setAnnotationTags((current) => current.filter((item) => item.id !== annotationTagId));
    },
    [apiBaseUrl, getToken, setAnnotationTags],
  );

  const applyAnnotationTagLocal = useCallback(
    (annotationTagId: string, patch: Partial<AnnotationTag>) => {
      setAnnotationTags((current) =>
        current.map((item) => (item.id === annotationTagId ? { ...item, ...patch } : item)),
      );
    },
    [setAnnotationTags],
  );

  const commitAnnotationTagUpdate = useCallback(
    async (annotationTagId: string, input: UpdateAnnotationTagInput) => {
      const previous = annotationTagsRef.current.find((item) => item.id === annotationTagId);
      try {
        const updated = await updateAnnotationTag(
          apiBaseUrl,
          await getToken(),
          annotationTagId,
          input,
        );
        setAnnotationTags((current) =>
          current.map((item) => (item.id === annotationTagId ? updated : item)),
        );
      } catch (error) {
        if (previous) {
          setAnnotationTags((current) =>
            current.map((item) => (item.id === annotationTagId ? previous : item)),
          );
        }
        throw error;
      }
    },
    [apiBaseUrl, getToken, annotationTagsRef, setAnnotationTags],
  );

  return useMemo(
    () => ({
      annotationTags,
      annotationTagsError,
      tagsVisible,
      setTagsVisible,
      tagModeEnabled,
      setTagModeEnabled,
      tagDraft,
      startTagDraft,
      cancelTagDraft,
      submitTagDraft,
      removeAnnotationTag,
      reloadAnnotationTags,
      applyAnnotationTagLocal,
      commitAnnotationTagUpdate,
    }),
    [
      annotationTags,
      annotationTagsError,
      tagsVisible,
      setTagsVisible,
      tagModeEnabled,
      tagDraft,
      startTagDraft,
      cancelTagDraft,
      submitTagDraft,
      removeAnnotationTag,
      reloadAnnotationTags,
      applyAnnotationTagLocal,
      commitAnnotationTagUpdate,
    ],
  );
}

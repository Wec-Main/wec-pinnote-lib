import { useCallback, useEffect, useState } from "react";
import {
  createAnnotationTag,
  deleteAnnotationTag,
  fetchAnnotationTags,
  fetchPreferences,
  saveTagsVisible,
} from "../services/annotationTagsApi";
import type { AnnotationTag, DraftTagPin } from "../types/annotationTag.types";
import type { AnnotationAnchor } from "../types/annotation.types";
import { createClientId } from "../utils/format";

interface UseAnnotationTagsOptions {
  apiBaseUrl: string;
  projectId: string;
  pageKey: string;
  authToken: string | undefined;
  enabled: boolean;
}

export interface AnnotationTagsState {
  annotationTags: AnnotationTag[];
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
}

export function useAnnotationTags(options: UseAnnotationTagsOptions): AnnotationTagsState {
  const { apiBaseUrl, projectId, pageKey, authToken, enabled } = options;
  const [annotationTags, setAnnotationTags] = useState<AnnotationTag[]>([]);
  const [tagsVisible, setTagsVisibleState] = useState(true);
  const [tagModeEnabled, setTagModeEnabled] = useState(false);
  const [tagDraft, setTagDraft] = useState<DraftTagPin | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setAnnotationTags([]);
      return;
    }
    const controller = new AbortController();
    fetchAnnotationTags(apiBaseUrl, authToken, projectId, pageKey, controller.signal)
      .then(setAnnotationTags)
      .catch(() => undefined);
    return () => controller.abort();
  }, [apiBaseUrl, authToken, projectId, pageKey, enabled, reloadToken]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const controller = new AbortController();
    fetchPreferences(apiBaseUrl, authToken, projectId, controller.signal)
      .then((preferences) => setTagsVisibleState(preferences.tagsVisible))
      .catch(() => undefined);
    return () => controller.abort();
  }, [apiBaseUrl, authToken, projectId, enabled]);

  const reloadAnnotationTags = useCallback(() => setReloadToken((token) => token + 1), []);

  /** Applied locally first so the toggle stays responsive; the server is the record of it. */
  const setTagsVisible = useCallback(
    (visible: boolean) => {
      setTagsVisibleState(visible);
      saveTagsVisible(apiBaseUrl, authToken, projectId, visible).catch(() => undefined);
    },
    [apiBaseUrl, authToken, projectId],
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
      const created = await createAnnotationTag(apiBaseUrl, authToken, {
        projectId,
        pageKey,
        tagId,
        anchor: tagDraft.anchor,
      });
      setAnnotationTags((current) => [created, ...current]);
      setTagDraft(null);
    },
    [apiBaseUrl, authToken, projectId, pageKey, tagDraft],
  );

  const removeAnnotationTag = useCallback(
    async (annotationTagId: string) => {
      await deleteAnnotationTag(apiBaseUrl, authToken, annotationTagId);
      setAnnotationTags((current) => current.filter((item) => item.id !== annotationTagId));
    },
    [apiBaseUrl, authToken],
  );

  return {
    annotationTags,
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
  };
}

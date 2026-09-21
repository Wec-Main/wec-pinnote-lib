import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "../styles/annotation.css";
import { AnnotationErrorBoundary } from "../components/AnnotationErrorBoundary";
import { AnnotationLayer } from "../components/AnnotationLayer";
import { useAnnotationApi } from "../hooks/useAnnotationApi";
import { useAnnotationCollection } from "../hooks/useAnnotations";
import { usePageKey } from "../hooks/usePageKey";
import type {
  AnnotationAnchor,
  AnnotationConfig,
  AnnotationStatus,
  DraftAnnotation,
  ResolvedAnnotationConfig,
} from "../types/annotation.types";
import { AnnotationContext, type AnnotationContextValue } from "./AnnotationContext";

const DEFAULT_Z_INDEX = 2147483000;

function authorNameStorageKey(projectId: string): string {
  return `wpn-author-name:${projectId}`;
}

function readStoredAuthorName(projectId: string): string {
  try {
    return window.localStorage.getItem(authorNameStorageKey(projectId)) ?? "";
  } catch {
    return "";
  }
}

function writeStoredAuthorName(projectId: string, name: string): void {
  try {
    window.localStorage.setItem(authorNameStorageKey(projectId), name);
  } catch {
    // Ignore storage failures (private browsing, disabled storage, etc.).
  }
}

function resolveConfig(config: AnnotationConfig): ResolvedAnnotationConfig {
  return {
    ...config,
    zIndex: config.zIndex ?? DEFAULT_Z_INDEX,
    enabled: config.enabled ?? true,
    showToggleButton: config.showToggleButton ?? true,
    showPinsWhenIdle: config.showPinsWhenIdle ?? true,
    showResolved: config.showResolved ?? true,
  };
}

export interface AnnotationProviderProps {
  config: AnnotationConfig;
  children: ReactNode;
}

export function AnnotationProvider({ config, children }: AnnotationProviderProps) {
  const resolved = useMemo(() => resolveConfig(config), [config]);
  const [authorName, setAuthorNameState] = useState(() => readStoredAuthorName(resolved.projectId));
  const setAuthorName = useCallback(
    (name: string) => {
      setAuthorNameState(name);
      writeStoredAuthorName(resolved.projectId, name);
    },
    [resolved.projectId],
  );
  const activeUser = useMemo(() => {
    const trimmedName = authorName.trim();
    const isAnonymous = resolved.currentUser.id === "anonymous";
    return {
      ...resolved.currentUser,
      id: isAnonymous && trimmedName ? trimmedName : resolved.currentUser.id,
      name: trimmedName || resolved.currentUser.name,
    };
  }, [authorName, resolved.currentUser]);
  const activeConfig = useMemo(() => ({ ...resolved, currentUser: activeUser }), [activeUser, resolved]);
  const api = useAnnotationApi(activeConfig);
  const pageKey = usePageKey(activeConfig.getPageKey);
  const collection = useAnnotationCollection(api, activeConfig.projectId, pageKey, activeUser);

  const [modeEnabled, setModeEnabledState] = useState(false);
  const setModeEnabled = useCallback((enabled: boolean) => {
    if (enabled && !authorName.trim()) {
      return;
    }
    setModeEnabledState(enabled);
  }, [authorName]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftAnnotation | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [pinsVisible, setPinsVisible] = useState(true);

  useEffect(() => {
    setDraft(null);
    setSelectedId(null);
    setListOpen(false);
  }, [pageKey]);

  useEffect(() => {
    if (!resolved.enabled) {
      setModeEnabledState(false);
    }
  }, [resolved.enabled]);

  useEffect(() => {
    if (!authorName.trim()) {
      setModeEnabledState(false);
    }
  }, [authorName]);

  useEffect(() => {
    document.body.classList.toggle("wpn-mode-active", resolved.enabled && modeEnabled);
    return () => {
      document.body.classList.remove("wpn-mode-active");
    };
  }, [modeEnabled, resolved.enabled]);

  const startDraft = useCallback(
    (anchor: AnnotationAnchor, label: string) => {
      const number = collection.annotations.reduce((max, item) => Math.max(max, item.number), 0) + 1;
      setSelectedId(null);
      setDraft({
        id: `draft-${number}`,
        label,
        anchor,
        number,
      });
    },
    [collection.annotations],
  );

  const cancelDraft = useCallback(() => {
    setDraft(null);
  }, []);

  const updateDraftLabel = useCallback((label: string) => {
    const trimmed = label.trim();
    if (!trimmed) {
      return;
    }
    setDraft((current) =>
      current
        ? {
            ...current,
            label: trimmed,
            anchor: { ...current.anchor, elementIdentifier: trimmed },
          }
        : current,
    );
  }, []);

  const submitDraft = useCallback(
    async (message: string, status?: AnnotationStatus) => {
      if (!draft) {
        return;
      }
      const created = await collection.createAnnotation({
        projectId: activeConfig.projectId,
        pageKey,
        anchor: draft.anchor,
        comment: {
          message,
          authorId: activeConfig.currentUser.id,
          authorName: activeConfig.currentUser.name,
        },
        status,
      });
      setDraft(null);
      setSelectedId(created.id);
    },
    [activeConfig.currentUser.name, activeConfig.projectId, collection, draft, pageKey],
  );

  const selectAnnotation = useCallback((id: string | null) => {
    setDraft(null);
    setSelectedId(id);
  }, []);

  const value = useMemo<AnnotationContextValue>(
    () => ({
      config: activeConfig,
      authorName,
      setAuthorName,
      api,
      pageKey,
      annotations: collection.annotations,
      pageStatus: collection.pageStatus,
      loading: collection.loading,
      error: collection.error,
      retry: collection.retry,
      modeEnabled,
      setModeEnabled,
      selectedId,
      selectAnnotation,
      draft,
      startDraft,
      updateDraftLabel,
      cancelDraft,
      submitDraft,
      addComment: collection.addComment,
      editComment: collection.editComment,
      removeComment: collection.removeComment,
      setPageStatus: collection.setPageStatus,
      setStatus: collection.setStatus,
      removeAnnotation: collection.removeAnnotation,
      pinsVisible,
      setPinsVisible,
      listOpen,
      setListOpen,
      actionError: collection.actionError,
      clearActionError: collection.clearActionError,
    }),
    [
      activeConfig,
      api,
      authorName,
      cancelDraft,
      collection.actionError,
      collection.addComment,
      collection.annotations,
      collection.clearActionError,
      collection.editComment,
      collection.error,
      collection.loading,
      collection.removeAnnotation,
      collection.removeComment,
      collection.retry,
      collection.pageStatus,
      collection.setPageStatus,
      collection.setStatus,
      draft,
      listOpen,
      modeEnabled,
      pageKey,
      pinsVisible,
      setModeEnabled,
      selectAnnotation,
      selectedId,
      startDraft,
      submitDraft,
      updateDraftLabel,
    ],
  );

  return (
    <AnnotationContext.Provider value={value}>
      {children}
      {activeConfig.enabled
        ? createPortal(
            <AnnotationErrorBoundary>
              <AnnotationLayer />
            </AnnotationErrorBoundary>,
            document.body,
          )
        : null}
    </AnnotationContext.Provider>
  );
}

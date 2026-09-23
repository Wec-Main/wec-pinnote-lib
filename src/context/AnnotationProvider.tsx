import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "../styles/annotation.css";
import { AnnotationErrorBoundary } from "../components/AnnotationErrorBoundary";
import { AnnotationLayer } from "../components/AnnotationLayer";
import { useAnnotationApi } from "../hooks/useAnnotationApi";
import { useAuthSessions } from "../hooks/useAuthSessions";
import { useAnnotationCollection } from "../hooks/useAnnotations";
import { usePageKey } from "../hooks/usePageKey";
import type {
  AnnotationAnchor,
  AnnotationConfig,
  AnnotationStatus,
  DraftAnnotation,
  ResolvedAnnotationConfig,
} from "../types/annotation.types";
import {
  AnnotationAuthContext,
  AnnotationDataContext,
  AnnotationUiContext,
  type AnnotationAuthContextValue,
  type AnnotationDataContextValue,
  type AnnotationUiContextValue,
  type DiscardPrompt,
} from "./AnnotationContext";
import { resolveElement } from "../utils/elementResolver";
import { isBoolean, usePersistentState } from "../hooks/usePersistentState";
import { useAnnotationTags } from "../hooks/useAnnotationTags";
import { useSharedFetch } from "../hooks/useSharedFetch";
import { fetchTags } from "../services/tagsApi";
import type { ProjectTag } from "../types/tag.types";

const DEFAULT_Z_INDEX = 2147483000;

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
  const auth = useAuthSessions(resolved.apiBaseUrl, resolved.projectId, resolved.authClient);
  const { activeAccount } = auth;
  const [loggingOutId, setLoggingOutId] = useState<string | null>(null);
  const teardownActive = activeAccount !== null && activeAccount.id !== loggingOutId;
  const logout = useCallback(
    async (userId: string) => {
      setLoggingOutId(userId);
      try {
        await auth.logout(userId);
      } finally {
        setLoggingOutId((current) => (current === userId ? null : current));
      }
    },
    [auth],
  );
  const activeUser = useMemo(() => {
    if (!activeAccount) {
      return resolved.currentUser;
    }
    return {
      id: activeAccount.id,
      name: activeAccount.name,
      avatarUrl: activeAccount.avatarUrl ?? resolved.currentUser.avatarUrl,
    };
  }, [activeAccount, resolved.currentUser]);
  const activeConfig = useMemo(
    () => ({
      ...resolved,
      currentUser: activeUser,
      getAuthToken:
        resolved.getAuthToken ?? (activeAccount ? () => activeAccount.token : undefined),
    }),
    [activeAccount, activeUser, resolved],
  );
  const api = useAnnotationApi(activeConfig);
  const pageKey = usePageKey(activeConfig.getPageKey);
  const collection = useAnnotationCollection(
    api,
    activeConfig.projectId,
    pageKey,
    activeUser,
    teardownActive,
    activeConfig.apiClient ? undefined : activeConfig.apiBaseUrl,
    activeAccount?.token,
  );

  const [modeEnabled, setModeEnabledState] = useState(false);
  const setModeEnabled = useCallback(
    (enabled: boolean) => {
      if (enabled && !activeAccount) {
        return;
      }
      setModeEnabledState(enabled);
    },
    [activeAccount],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftAnnotation | null>(null);
  const [discardPrompt, setDiscardPrompt] = useState<DiscardPrompt | null>(null);
  const projectId = activeConfig.projectId;
  const [listOpen, setListOpen] = usePersistentState(
    `wpn-ui:${projectId}:listOpen`,
    false,
    isBoolean,
  );
  const [epicFlowOpen, setEpicFlowOpen] = usePersistentState(
    `wpn-ui:${projectId}:epicFlowOpen`,
    false,
    isBoolean,
  );
  const [userManagementOpen, setUserManagementOpen] = usePersistentState(
    `wpn-ui:${projectId}:userManagementOpen`,
    false,
    isBoolean,
  );
  const [auditHistoryOpen, setAuditHistoryOpen] = usePersistentState(
    `wpn-ui:${projectId}:auditHistoryOpen`,
    false,
    isBoolean,
  );
  const [pinsVisible, setPinsVisible] = usePersistentState(
    `wpn-ui:${projectId}:pinsVisible`,
    true,
    isBoolean,
  );

  const tags = useAnnotationTags({
    apiBaseUrl: activeConfig.apiBaseUrl,
    projectId,
    pageKey,
    authToken: activeAccount?.token,
    enabled: Boolean(activeAccount),
  });

  const projectTagsToken = activeAccount?.token;
  const projectTagsKey = projectTagsToken
    ? `project-tags:${activeConfig.apiBaseUrl}:${projectTagsToken}:${projectId}:active`
    : null;
  const { data: projectTagsData } = useSharedFetch<ProjectTag[]>(projectTagsKey, (signal) =>
    fetchTags(activeConfig.apiBaseUrl, projectTagsToken, { projectId, status: "active" }, signal),
  );
  const projectTags = useMemo(() => projectTagsData ?? [], [projectTagsData]);

  const setModeEnabledExclusive = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        tags.setTagModeEnabled(false);
        tags.cancelTagDraft();
      }
      setModeEnabled(enabled);
    },
    [setModeEnabled, tags],
  );

  const setTagModeEnabled = useCallback(
    (enabled: boolean) => {
      if (enabled && !activeAccount) {
        return;
      }
      if (enabled) {
        setModeEnabled(false);
        setDraft(null);
      } else {
        tags.cancelTagDraft();
      }
      tags.setTagModeEnabled(enabled);
    },
    [activeAccount, setModeEnabled, tags],
  );

  const openListExclusive = useCallback(
    (open: boolean) => {
      setListOpen(open);
      if (open) {
        setEpicFlowOpen(false);
        setUserManagementOpen(false);
      }
    },
    [setEpicFlowOpen, setListOpen, setUserManagementOpen],
  );
  const openEpicFlowExclusive = useCallback(
    (open: boolean) => {
      setEpicFlowOpen(open);
      if (open) {
        setListOpen(false);
        setUserManagementOpen(false);
      }
    },
    [setEpicFlowOpen, setListOpen, setUserManagementOpen],
  );
  const openUserManagementExclusive = useCallback(
    (open: boolean) => {
      setUserManagementOpen(open);
      if (open) {
        setListOpen(false);
        setEpicFlowOpen(false);
      }
    },
    [setEpicFlowOpen, setListOpen, setUserManagementOpen],
  );

  const previousPageKeyRef = useRef(pageKey);
  useEffect(() => {
    if (previousPageKeyRef.current === pageKey) {
      return;
    }
    previousPageKeyRef.current = pageKey;
    setDraft(null);
    setSelectedId(null);
    setDiscardPrompt(null);
  }, [pageKey]);

  useEffect(() => {
    if (!resolved.enabled) {
      setModeEnabledState(false);
    }
  }, [resolved.enabled]);

  useEffect(() => {
    if (!activeAccount) {
      setModeEnabledState(false);
      setListOpen(false);
      setEpicFlowOpen(false);
      setUserManagementOpen(false);
      setAuditHistoryOpen(false);
    }
  }, [activeAccount, setAuditHistoryOpen, setEpicFlowOpen, setListOpen, setUserManagementOpen]);

  useEffect(() => {
    document.body.classList.toggle("wpn-mode-active", resolved.enabled && modeEnabled);
    return () => {
      document.body.classList.remove("wpn-mode-active");
    };
  }, [modeEnabled, resolved.enabled]);

  const draftRef = useRef(draft);
  draftRef.current = draft;

  const startDraft = useCallback(
    (anchor: AnnotationAnchor, label: string) => {
      const number =
        collection.annotations.reduce((max, item) => Math.max(max, item.number), 0) + 1;
      setSelectedId(null);
      setDraft({
        id: `draft-${number}`,
        label,
        anchor,
        number,
        message: "",
      });
    },
    [collection.annotations],
  );

  const cancelDraft = useCallback(() => {
    setDraft(null);
    setDiscardPrompt(null);
  }, []);

  const requestCancelDraft = useCallback(() => {
    if (draftRef.current && draftRef.current.message.trim()) {
      setDiscardPrompt({ kind: "draft", proceed: cancelDraft });
      return;
    }
    cancelDraft();
  }, [cancelDraft]);

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

  const updateDraftMessage = useCallback((message: string) => {
    setDraft((current) => (current ? { ...current, message } : current));
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
    [
      activeConfig.currentUser.id,
      activeConfig.currentUser.name,
      activeConfig.projectId,
      collection,
      draft,
      pageKey,
    ],
  );

  const selectAnnotation = useCallback((id: string | null) => {
    if (draftRef.current && draftRef.current.message.trim()) {
      setDiscardPrompt({
        kind: "draft",
        proceed: () => {
          setDraft(null);
          setSelectedId(id);
        },
      });
      return;
    }
    setDraft(null);
    setSelectedId(id);
  }, []);

  const revealAnnotation = useCallback(
    (id: string) => {
      const annotation = collection.annotations.find((item) => item.id === id);
      const proceed = () => {
        setDraft(null);
        setPinsVisible(true);
        setSelectedId(id);
        if (!annotation) {
          return;
        }
        const element = resolveElement(annotation.anchor);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
          return;
        }
        window.scrollTo({
          top: Math.max(0, annotation.anchor.fallbackY - window.innerHeight / 2),
          left: 0,
          behavior: "smooth",
        });
      };
      if (draftRef.current && draftRef.current.message.trim()) {
        setDiscardPrompt({ kind: "draft", proceed });
        return;
      }
      proceed();
    },
    [collection.annotations, setPinsVisible],
  );

  const confirmDiscard = useCallback(() => {
    const prompt = discardPrompt;
    setDiscardPrompt(null);
    prompt?.proceed();
  }, [discardPrompt]);

  const cancelDiscardPrompt = useCallback(() => {
    setDiscardPrompt(null);
  }, []);

  const dataValue = useMemo<AnnotationDataContextValue>(
    () => ({
      config: activeConfig,
      api,
      pageKey,
      annotations: collection.annotations,
      pageStatus: collection.pageStatus,
      loading: collection.loading,
      error: collection.error,
      connectionState: collection.connectionState,
      retry: collection.retry,
      actionError: collection.actionError,
      clearActionError: collection.clearActionError,
      addComment: collection.addComment,
      editComment: collection.editComment,
      removeComment: collection.removeComment,
      setPageStatus: collection.setPageStatus,
      setStatus: collection.setStatus,
      removeAnnotation: collection.removeAnnotation,
      submitDraft,
      annotationTags: tags.annotationTags,
      projectTags,
      submitTagDraft: tags.submitTagDraft,
      removeAnnotationTag: tags.removeAnnotationTag,
    }),
    [
      activeConfig,
      api,
      pageKey,
      collection.actionError,
      collection.addComment,
      collection.annotations,
      collection.clearActionError,
      collection.editComment,
      collection.connectionState,
      collection.error,
      collection.loading,
      collection.removeAnnotation,
      collection.removeComment,
      collection.retry,
      collection.pageStatus,
      collection.setPageStatus,
      collection.setStatus,
      submitDraft,
      projectTags,
      tags.annotationTags,
      tags.submitTagDraft,
      tags.removeAnnotationTag,
    ],
  );

  const uiValue = useMemo<AnnotationUiContextValue>(
    () => ({
      modeEnabled,
      setModeEnabled: setModeEnabledExclusive,
      selectedId,
      selectAnnotation,
      revealAnnotation,
      draft,
      startDraft,
      updateDraftLabel,
      updateDraftMessage,
      cancelDraft,
      requestCancelDraft,
      discardPrompt,
      confirmDiscard,
      cancelDiscardPrompt,
      pinsVisible,
      setPinsVisible,
      tagModeEnabled: tags.tagModeEnabled,
      setTagModeEnabled,
      tagsVisible: tags.tagsVisible,
      setTagsVisible: tags.setTagsVisible,
      tagDraft: tags.tagDraft,
      startTagDraft: tags.startTagDraft,
      cancelTagDraft: tags.cancelTagDraft,
      listOpen,
      setListOpen: openListExclusive,
      epicFlowOpen,
      setEpicFlowOpen: openEpicFlowExclusive,
      userManagementOpen,
      setUserManagementOpen: openUserManagementExclusive,
      auditHistoryOpen,
      setAuditHistoryOpen,
    }),
    [
      cancelDraft,
      requestCancelDraft,
      updateDraftMessage,
      discardPrompt,
      confirmDiscard,
      cancelDiscardPrompt,
      draft,
      epicFlowOpen,
      userManagementOpen,
      auditHistoryOpen,
      listOpen,
      modeEnabled,
      pinsVisible,
      setAuditHistoryOpen,
      openEpicFlowExclusive,
      openListExclusive,
      setPinsVisible,
      openUserManagementExclusive,
      setModeEnabledExclusive,
      setTagModeEnabled,
      tags.tagModeEnabled,
      tags.tagsVisible,
      tags.setTagsVisible,
      tags.tagDraft,
      tags.startTagDraft,
      tags.cancelTagDraft,
      selectAnnotation,
      revealAnnotation,
      selectedId,
      startDraft,
      updateDraftLabel,
    ],
  );

  const authValue = useMemo<AnnotationAuthContextValue>(
    () => ({
      accounts: auth.accounts,
      activeAccount: auth.activeAccount,
      loginOptions: auth.loginOptions,
      loginOptionsLoading: auth.loginOptionsLoading,
      loginOptionsError: auth.loginOptionsError,
      reloadLoginOptions: auth.reloadLoginOptions,
      login: auth.login,
      logout,
      switchAccount: auth.switchAccount,
    }),
    [
      auth.accounts,
      auth.activeAccount,
      auth.loginOptions,
      auth.loginOptionsLoading,
      auth.loginOptionsError,
      auth.reloadLoginOptions,
      auth.login,
      logout,
      auth.switchAccount,
    ],
  );

  return (
    <AnnotationAuthContext.Provider value={authValue}>
      <AnnotationDataContext.Provider value={dataValue}>
        <AnnotationUiContext.Provider value={uiValue}>
          {children}
          {activeConfig.enabled
            ? createPortal(
                <AnnotationErrorBoundary>
                  <AnnotationLayer />
                </AnnotationErrorBoundary>,
                document.body,
              )
            : null}
        </AnnotationUiContext.Provider>
      </AnnotationDataContext.Provider>
    </AnnotationAuthContext.Provider>
  );
}

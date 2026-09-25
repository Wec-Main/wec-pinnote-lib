import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "../styles/annotation.css";
import "../styles/flowchart.css";
import { AnnotationErrorBoundary } from "../components/AnnotationErrorBoundary";
import { AnnotationLayer } from "../components/AnnotationLayer";
import { useAnnotationApi } from "../hooks/useAnnotationApi";
import { useAuthSessions } from "../hooks/useAuthSessions";
import { useAnnotationCollection } from "../hooks/useAnnotations";
import { usePageKey } from "../hooks/usePageKey";
import { usePageVisitTracker } from "../hooks/usePageVisitTracker";
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
import { usePersistentState } from "../hooks/usePersistentState";
import { isBoolean } from "../utils/valueGuards";
import { useAnnotationTags } from "../hooks/useAnnotationTags";
import { useFlowPins } from "../hooks/useFlowPins";
import { useSharedFetch } from "../hooks/useSharedFetch";
import { useTokenGetter } from "../hooks/useTokenGetter";
import { fetchTags } from "../services/tagsApi";
import { createClientId } from "../utils/format";
import { isTrackingEnabled } from "../utils/pageVisitQueue";
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
  const {
    accounts,
    activeAccount,
    loginOptions,
    loginOptionsLoading,
    loginOptionsError,
    reloadLoginOptions,
    login,
    logout: revokeSession,
    switchAccount,
    revokeError,
    clearRevokeError,
  } = useAuthSessions(resolved.apiBaseUrl, resolved.projectId, resolved.authClient);
  const hostAuthenticated = Boolean(resolved.getAuthToken);
  const authenticated = hostAuthenticated || activeAccount !== null;
  const sessionKey = hostAuthenticated ? "host" : (activeAccount?.id ?? null);
  const [loggingOutId, setLoggingOutId] = useState<string | null>(null);
  const teardownActive =
    hostAuthenticated || (activeAccount !== null && activeAccount.id !== loggingOutId);
  const logout = useCallback(
    async (userId: string) => {
      setLoggingOutId(userId);
      try {
        await revokeSession(userId);
      } finally {
        setLoggingOutId((current) => (current === userId ? null : current));
      }
    },
    [revokeSession],
  );
  const accountId = activeAccount?.id;
  const accountName = activeAccount?.name;
  const accountAvatarUrl = activeAccount?.avatarUrl;
  const activeUser = useMemo(() => {
    if (hostAuthenticated || accountId === undefined || accountName === undefined) {
      return resolved.currentUser;
    }
    return {
      id: accountId,
      name: accountName,
      avatarUrl: accountAvatarUrl ?? resolved.currentUser.avatarUrl,
    };
  }, [accountAvatarUrl, accountId, accountName, hostAuthenticated, resolved.currentUser]);
  const accountTokenRef = useRef(activeAccount?.token);
  accountTokenRef.current = activeAccount?.token;
  const readAccountToken = useCallback(() => accountTokenRef.current ?? "", []);
  const hasAccount = activeAccount !== null;
  const activeConfig = useMemo(
    () => ({
      ...resolved,
      currentUser: activeUser,
      getAuthToken: resolved.getAuthToken ?? (hasAccount ? readAccountToken : undefined),
    }),
    [activeUser, hasAccount, readAccountToken, resolved],
  );
  const api = useAnnotationApi(activeConfig);
  const pageKey = usePageKey(activeConfig.getPageKey);
  const {
    annotations,
    loading,
    error,
    connectionState,
    retry,
    actionError,
    clearActionError,
    createAnnotation,
    addComment,
    editComment,
    removeComment,
    setStatus,
    removeAnnotation,
  } = useAnnotationCollection({
    api,
    projectId: activeConfig.projectId,
    pageKey,
    currentUser: activeUser,
    authenticated: teardownActive,
    apiBaseUrl: activeConfig.apiBaseUrl,
    getAuthToken: activeConfig.getAuthToken,
    sessionKey: sessionKey ?? "",
    events: resolved,
  });

  const [modeEnabled, setModeEnabledState] = useState(false);
  const setModeEnabled = useCallback(
    (enabled: boolean) => {
      if (enabled && !authenticated) {
        return;
      }
      setModeEnabledState(enabled);
    },
    [authenticated],
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
  const [flowOpen, setFlowOpen] = usePersistentState(
    `wpn-ui:${projectId}:flowOpen`,
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

  const {
    annotationTags,
    tagsVisible,
    setTagsVisible,
    tagModeEnabled,
    setTagModeEnabled: setTagHookModeEnabled,
    tagDraft,
    startTagDraft,
    cancelTagDraft,
    submitTagDraft,
    removeAnnotationTag,
  } = useAnnotationTags({
    apiBaseUrl: activeConfig.apiBaseUrl,
    projectId,
    pageKey,
    getAuthToken: activeConfig.getAuthToken,
    sessionKey,
    enabled: authenticated,
  });

  const {
    flowPins,
    flowPinsVisible,
    setFlowPinsVisible,
    flowPinModeEnabled,
    setFlowPinModeEnabled: setFlowPinHookModeEnabled,
    flowPinDraft,
    startFlowPinDraft,
    cancelFlowPinDraft,
    submitFlowPinDraft,
    removeFlowPin,
    syncFlowPinName,
    selectedFlowPinId,
    selectFlowPin,
  } = useFlowPins({
    apiBaseUrl: activeConfig.apiBaseUrl,
    projectId,
    pageKey,
    getAuthToken: activeConfig.getAuthToken,
    sessionKey,
    enabled: authenticated,
  });

  usePageVisitTracker({
    apiBaseUrl: activeConfig.apiBaseUrl,
    projectId,
    pageKey,
    enabled: isTrackingEnabled(resolved.trackPageVisits, authenticated),
    getAuthToken: activeConfig.getAuthToken,
    sessionKey,
  });

  const getProjectTagsToken = useTokenGetter(activeConfig.getAuthToken);
  const projectTagsKey =
    authenticated && sessionKey
      ? `project-tags:${activeConfig.apiBaseUrl}:${sessionKey}:${projectId}:active`
      : null;
  const { data: projectTagsData, reload: reloadProjectTags } = useSharedFetch<ProjectTag[]>(
    projectTagsKey,
    async (signal) =>
      fetchTags(
        activeConfig.apiBaseUrl,
        await getProjectTagsToken(),
        { projectId, status: "active" },
        signal,
      ),
  );
  const projectTags = useMemo(() => projectTagsData ?? [], [projectTagsData]);
  const tagDraftId = tagDraft?.id;

  useEffect(() => {
    if (tagDraftId) {
      reloadProjectTags();
    }
  }, [tagDraftId, reloadProjectTags]);

  const setModeEnabledExclusive = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        setTagHookModeEnabled(false);
        cancelTagDraft();
        setFlowPinHookModeEnabled(false);
      }
      setModeEnabled(enabled);
    },
    [cancelTagDraft, setFlowPinHookModeEnabled, setModeEnabled, setTagHookModeEnabled],
  );

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const draftMessageRef = useRef("");
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;
  const hasUnsavedDraft = useCallback(
    () => draftRef.current !== null && draftMessageRef.current.trim() !== "",
    [],
  );
  const clearDraft = useCallback(() => {
    draftMessageRef.current = "";
    setDraft(null);
  }, []);

  const setTagModeEnabled = useCallback(
    (enabled: boolean) => {
      if (enabled && !authenticated) {
        return;
      }
      if (enabled) {
        setModeEnabled(false);
        clearDraft();
        setFlowPinHookModeEnabled(false);
      } else {
        cancelTagDraft();
      }
      setTagHookModeEnabled(enabled);
    },
    [
      authenticated,
      cancelTagDraft,
      clearDraft,
      setFlowPinHookModeEnabled,
      setModeEnabled,
      setTagHookModeEnabled,
    ],
  );

  const setFlowPinModeEnabled = useCallback(
    (enabled: boolean) => {
      if (enabled && !authenticated) {
        return;
      }
      if (enabled) {
        setModeEnabled(false);
        clearDraft();
        setTagHookModeEnabled(false);
        cancelTagDraft();
      }
      setFlowPinHookModeEnabled(enabled);
    },
    [
      authenticated,
      cancelTagDraft,
      clearDraft,
      setFlowPinHookModeEnabled,
      setModeEnabled,
      setTagHookModeEnabled,
    ],
  );

  const openListExclusive = useCallback(
    (open: boolean) => {
      setListOpen(open);
      if (open) {
        setEpicFlowOpen(false);
        setFlowOpen(false);
        setUserManagementOpen(false);
      }
    },
    [setEpicFlowOpen, setFlowOpen, setListOpen, setUserManagementOpen],
  );
  const openEpicFlowExclusive = useCallback(
    (open: boolean) => {
      setEpicFlowOpen(open);
      if (open) {
        setListOpen(false);
        setFlowOpen(false);
        setUserManagementOpen(false);
      }
    },
    [setEpicFlowOpen, setFlowOpen, setListOpen, setUserManagementOpen],
  );
  const openFlowExclusive = useCallback(
    (open: boolean) => {
      setFlowOpen(open);
      if (open) {
        setListOpen(false);
        setEpicFlowOpen(false);
        setUserManagementOpen(false);
      }
    },
    [setEpicFlowOpen, setFlowOpen, setListOpen, setUserManagementOpen],
  );
  const openUserManagementExclusive = useCallback(
    (open: boolean) => {
      setUserManagementOpen(open);
      if (open) {
        setListOpen(false);
        setEpicFlowOpen(false);
        setFlowOpen(false);
      }
    },
    [setEpicFlowOpen, setFlowOpen, setListOpen, setUserManagementOpen],
  );

  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => {
    setPortalReady(true);
  }, []);

  const previousPageKeyRef = useRef(pageKey);
  useEffect(() => {
    if (previousPageKeyRef.current === pageKey) {
      return;
    }
    previousPageKeyRef.current = pageKey;
    clearDraft();
    setSelectedId(null);
    setDiscardPrompt(null);
  }, [clearDraft, pageKey]);

  useEffect(() => {
    if (!resolved.enabled) {
      setModeEnabledState(false);
    }
  }, [resolved.enabled]);

  useEffect(() => {
    if (!authenticated) {
      setModeEnabledState(false);
      setListOpen(false);
      setEpicFlowOpen(false);
      setFlowOpen(false);
      setUserManagementOpen(false);
      setAuditHistoryOpen(false);
      setFlowPinHookModeEnabled(false);
      selectFlowPin(null);
    }
  }, [
    authenticated,
    selectFlowPin,
    setAuditHistoryOpen,
    setEpicFlowOpen,
    setFlowOpen,
    setFlowPinHookModeEnabled,
    setListOpen,
    setUserManagementOpen,
  ]);

  useEffect(() => {
    document.body.classList.toggle("wpn-mode-active", resolved.enabled && modeEnabled);
    return () => {
      document.body.classList.remove("wpn-mode-active");
    };
  }, [modeEnabled, resolved.enabled]);

  const startDraft = useCallback((anchor: AnnotationAnchor, label: string) => {
    const number = annotationsRef.current.reduce((max, item) => Math.max(max, item.number), 0) + 1;
    draftMessageRef.current = "";
    setSelectedId(null);
    setDraft({
      id: createClientId("draft"),
      label,
      anchor,
      number,
      message: "",
    });
  }, []);

  const cancelDraft = useCallback(() => {
    clearDraft();
    setDiscardPrompt(null);
  }, [clearDraft]);

  const requestCancelDraft = useCallback(() => {
    if (hasUnsavedDraft()) {
      setDiscardPrompt({ kind: "draft", proceed: cancelDraft });
      return;
    }
    cancelDraft();
  }, [cancelDraft, hasUnsavedDraft]);

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
    draftMessageRef.current = message;
  }, []);

  const currentUserId = activeConfig.currentUser.id;
  const submitDraft = useCallback(
    async (message: string, status?: AnnotationStatus) => {
      const current = draftRef.current;
      if (!current) {
        return;
      }
      const typedMessage = draftMessageRef.current;
      clearDraft();
      try {
        const created = await createAnnotation({
          projectId,
          pageKey,
          anchor: current.anchor,
          comment: {
            message,
            authorId: currentUserId,
          },
          status,
        });
        setSelectedId(created.id);
      } catch (err) {
        draftMessageRef.current = typedMessage;
        setDraft((existing) => existing ?? { ...current, message: typedMessage });
        throw err;
      }
    },
    [clearDraft, createAnnotation, currentUserId, pageKey, projectId],
  );

  const selectAnnotation = useCallback(
    (id: string | null) => {
      const proceed = () => {
        clearDraft();
        setSelectedId(id);
      };
      if (hasUnsavedDraft()) {
        setDiscardPrompt({ kind: "draft", proceed });
        return;
      }
      proceed();
    },
    [clearDraft, hasUnsavedDraft],
  );

  const revealAnnotation = useCallback(
    (id: string) => {
      const annotation = annotationsRef.current.find((item) => item.id === id);
      const proceed = () => {
        clearDraft();
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
      if (hasUnsavedDraft()) {
        setDiscardPrompt({ kind: "draft", proceed });
        return;
      }
      proceed();
    },
    [clearDraft, hasUnsavedDraft, setPinsVisible],
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
      annotations,
      loading,
      error,
      connectionState,
      retry,
      actionError,
      clearActionError,
      createAnnotation,
      addComment,
      editComment,
      removeComment,
      setStatus,
      removeAnnotation,
      submitDraft,
      annotationTags,
      projectTags,
      submitTagDraft,
      removeAnnotationTag,
      flowPins,
      syncFlowPinName,
    }),
    [
      activeConfig,
      api,
      pageKey,
      annotations,
      loading,
      error,
      connectionState,
      retry,
      actionError,
      clearActionError,
      createAnnotation,
      addComment,
      editComment,
      removeComment,
      setStatus,
      removeAnnotation,
      submitDraft,
      annotationTags,
      projectTags,
      submitTagDraft,
      removeAnnotationTag,
      flowPins,
      syncFlowPinName,
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
      tagModeEnabled,
      setTagModeEnabled,
      tagsVisible,
      setTagsVisible,
      tagDraft,
      startTagDraft,
      cancelTagDraft,
      flowPinModeEnabled,
      setFlowPinModeEnabled,
      flowPinsVisible,
      setFlowPinsVisible,
      flowPinDraft,
      startFlowPinDraft,
      cancelFlowPinDraft,
      submitFlowPinDraft,
      removeFlowPin,
      selectedFlowPinId,
      selectFlowPin,
      listOpen,
      setListOpen: openListExclusive,
      epicFlowOpen,
      setEpicFlowOpen: openEpicFlowExclusive,
      flowOpen,
      setFlowOpen: openFlowExclusive,
      userManagementOpen,
      setUserManagementOpen: openUserManagementExclusive,
      auditHistoryOpen,
      setAuditHistoryOpen,
    }),
    [
      modeEnabled,
      setModeEnabledExclusive,
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
      tagModeEnabled,
      setTagModeEnabled,
      tagsVisible,
      setTagsVisible,
      tagDraft,
      startTagDraft,
      cancelTagDraft,
      flowPinModeEnabled,
      setFlowPinModeEnabled,
      flowPinsVisible,
      setFlowPinsVisible,
      flowPinDraft,
      startFlowPinDraft,
      cancelFlowPinDraft,
      submitFlowPinDraft,
      removeFlowPin,
      selectedFlowPinId,
      selectFlowPin,
      listOpen,
      openListExclusive,
      epicFlowOpen,
      openEpicFlowExclusive,
      flowOpen,
      openFlowExclusive,
      userManagementOpen,
      openUserManagementExclusive,
      auditHistoryOpen,
      setAuditHistoryOpen,
    ],
  );

  const authValue = useMemo<AnnotationAuthContextValue>(
    () => ({
      authenticated,
      hostAuthenticated,
      accounts,
      activeAccount,
      loginOptions,
      loginOptionsLoading,
      loginOptionsError,
      reloadLoginOptions,
      login,
      logout,
      switchAccount,
      revokeError,
      clearRevokeError,
    }),
    [
      authenticated,
      hostAuthenticated,
      accounts,
      activeAccount,
      loginOptions,
      loginOptionsLoading,
      loginOptionsError,
      reloadLoginOptions,
      login,
      logout,
      switchAccount,
      revokeError,
      clearRevokeError,
    ],
  );

  return (
    <AnnotationAuthContext.Provider value={authValue}>
      <AnnotationDataContext.Provider value={dataValue}>
        <AnnotationUiContext.Provider value={uiValue}>
          {children}
          {portalReady && activeConfig.enabled
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

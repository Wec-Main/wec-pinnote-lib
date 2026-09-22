import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
import { AnnotationContext, type AnnotationContextValue } from "./AnnotationContext";
import { actorToken } from "../services/actorIdentity";
import { resolveElement } from "../utils/elementResolver";
import { isBoolean, usePersistentState } from "../hooks/usePersistentState";

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
        resolved.getAuthToken ?? (activeAccount ? () => actorToken(activeAccount.id) : undefined),
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
    activeConfig.apiClient ? undefined : activeConfig.apiBaseUrl,
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

  useEffect(() => {
    setDraft(null);
    setSelectedId(null);
  }, [pageKey]);

  useEffect(() => {
    if (!resolved.enabled) {
      setModeEnabledState(false);
    }
  }, [resolved.enabled]);

  useEffect(() => {
    if (!activeAccount) {
      setModeEnabledState(false);
    }
  }, [activeAccount]);

  useEffect(() => {
    document.body.classList.toggle("wpn-mode-active", resolved.enabled && modeEnabled);
    return () => {
      document.body.classList.remove("wpn-mode-active");
    };
  }, [modeEnabled, resolved.enabled]);

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
    setDraft(null);
    setSelectedId(id);
  }, []);

  const revealAnnotation = useCallback(
    (id: string) => {
      const annotation = collection.annotations.find((item) => item.id === id);
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
    },
    [collection.annotations, setPinsVisible],
  );

  const value = useMemo<AnnotationContextValue>(
    () => ({
      config: activeConfig,
      accounts: auth.accounts,
      activeAccount: auth.activeAccount,
      loginOptions: auth.loginOptions,
      loginOptionsLoading: auth.loginOptionsLoading,
      loginOptionsError: auth.loginOptionsError,
      reloadLoginOptions: auth.reloadLoginOptions,
      login: auth.login,
      logout: auth.logout,
      switchAccount: auth.switchAccount,
      api,
      pageKey,
      annotations: collection.annotations,
      pageStatus: collection.pageStatus,
      loading: collection.loading,
      error: collection.error,
      connectionState: collection.connectionState,
      retry: collection.retry,
      modeEnabled,
      setModeEnabled,
      selectedId,
      selectAnnotation,
      revealAnnotation,
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
      setListOpen: openListExclusive,
      epicFlowOpen,
      setEpicFlowOpen: openEpicFlowExclusive,
      userManagementOpen,
      setUserManagementOpen: openUserManagementExclusive,
      auditHistoryOpen,
      setAuditHistoryOpen,
      actionError: collection.actionError,
      clearActionError: collection.clearActionError,
    }),
    [
      activeConfig,
      api,
      auth.accounts,
      auth.activeAccount,
      auth.loginOptions,
      auth.loginOptionsLoading,
      auth.loginOptionsError,
      auth.reloadLoginOptions,
      auth.login,
      auth.logout,
      auth.switchAccount,
      cancelDraft,
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
      draft,
      epicFlowOpen,
      userManagementOpen,
      auditHistoryOpen,
      listOpen,
      modeEnabled,
      pageKey,
      pinsVisible,
      setAuditHistoryOpen,
      openEpicFlowExclusive,
      openListExclusive,
      setModeEnabled,
      setPinsVisible,
      openUserManagementExclusive,
      selectAnnotation,
      revealAnnotation,
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

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "../styles/annotation.css";
import "../styles/flowchart.css";
import "../styles/datamodel.css";
import "../styles/ai.css";
import "../styles/prompts.css";
import "../styles/ai-dock.css";
import "../styles/ai-panel.css";
import "../styles/loading.css";
import { AnnotationErrorBoundary } from "../components/AnnotationErrorBoundary";
import { AiUiProvider } from "../components/Ai/AiUiContext";
import { AiRuntimeProvider } from "./AiRuntimeContext";
import { DEFAULT_PINNOTE_API_URL } from "../config/env";
import { AnnotationLayer } from "../components/AnnotationLayer";
import { useAnnotationApi } from "../hooks/useAnnotationApi";
import { useAuthSessions } from "../hooks/useAuthSessions";
import { nextNumber, useAnnotationCollection } from "../hooks/useAnnotations";
import { useAllProjectAnnotations } from "../hooks/useAllProjectAnnotations";
import { usePageKey } from "../hooks/usePageKey";
import { usePageVisitTracker } from "../hooks/usePageVisitTracker";
import { AnnotationViewContext } from "./AnnotationViewContext";
import { composeViewPageKey } from "../utils/pageKey";
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
  AnnotationStoreContext,
  AnnotationUiContext,
  type AnnotationAuthContextValue,
  type AnnotationContextValue,
  type AnnotationDataContextValue,
  type AnnotationUiContextValue,
  type FlowEditorSource,
  type DiscardPrompt,
} from "./AnnotationContext";
import { Store } from "../utils/flowchart/store";
import { resolveElement } from "../utils/elementResolver";
import { usePersistentState } from "../hooks/usePersistentState";
import { isBoolean } from "../utils/valueGuards";
import { useAnnotationTags } from "../hooks/useAnnotationTags";
import { useFlowPins } from "../hooks/useFlowPins";
import { useSharedFetch } from "../hooks/useSharedFetch";
import { useTokenGetter } from "../hooks/useTokenGetter";
import { fetchProject } from "../services/organizationsApi";
import type { Project } from "../types/organization.types";
import type { StreamEvent } from "../types/stream.types";
import type { VersionedLayer } from "./AnnotationContext";
import { fetchTags } from "../services/tagsApi";
import { resolveEffectiveProjectVersionId } from "../utils/resolveEffectiveProjectVersionId";
import { createClientId } from "../utils/format";
import { isTrackingEnabled } from "../utils/pageVisitQueue";
import type { ProjectTag } from "../types/tag.types";
import type { ReferenceTarget } from "../utils/mentions";

const DEFAULT_Z_INDEX = 2147483000;

interface LayerVersionSelection {
  scope: string;
  comments?: string;
  flows?: string;
}

function resolveConfig(config: AnnotationConfig): ResolvedAnnotationConfig {
  return {
    ...config,
    apiBaseUrl: config.apiBaseUrl ?? DEFAULT_PINNOTE_API_URL,
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
    getAccessToken,
    revokeError,
    clearRevokeError,
  } = useAuthSessions(
    resolved.apiBaseUrl,
    resolved.projectId,
    resolved.authClient,
    !resolved.getAuthToken,
  );
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
  const accountRole = activeAccount?.roleId;
  const activeUser = useMemo(() => {
    if (hostAuthenticated || accountId === undefined || accountName === undefined) {
      return resolved.currentUser;
    }
    return {
      id: accountId,
      name: accountName,
      avatarUrl: accountAvatarUrl ?? resolved.currentUser.avatarUrl,
      role: accountRole,
    };
  }, [
    accountAvatarUrl,
    accountId,
    accountName,
    accountRole,
    hostAuthenticated,
    resolved.currentUser,
  ]);
  const accountIdRef = useRef(activeAccount?.id);
  accountIdRef.current = activeAccount?.id;
  const readAccountToken = useCallback(async () => {
    const id = accountIdRef.current;
    return (id ? await getAccessToken(id) : undefined) ?? "";
  }, [getAccessToken]);
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
  const basePageKey = usePageKey(activeConfig.getPageKey);
  const [views, setViews] = useState<string[]>([]);
  const registerView = useCallback((name: string) => {
    setViews((current) => [...current, name]);
    return () => {
      setViews((current) => {
        const index = current.lastIndexOf(name);
        if (index === -1) {
          return current;
        }
        return [...current.slice(0, index), ...current.slice(index + 1)];
      });
    };
  }, []);
  const viewContextValue = useMemo(() => ({ registerView }), [registerView]);
  const pageKey = useMemo(() => composeViewPageKey(basePageKey, views), [basePageKey, views]);

  const projectId = activeConfig.projectId;
  const getProjectVersionToken = useTokenGetter(activeConfig.getAuthToken);
  const projectVersionKey =
    authenticated && sessionKey
      ? `project-current-version:${activeConfig.apiBaseUrl}:${sessionKey}:${projectId}`
      : null;
  const {
    data: liveProject,
    error: liveProjectError,
    reload: reloadCurrentProjectVersion,
  } = useSharedFetch<Project>(projectVersionKey, async (signal) =>
    fetchProject(activeConfig.apiBaseUrl, await getProjectVersionToken(), projectId, signal),
  );
  const projectVersionId = resolveEffectiveProjectVersionId(
    activeConfig.projectVersionId,
    liveProject?.currentProjectVersionId,
  );
  const projectVersionResolved =
    activeConfig.projectVersionId !== undefined ||
    liveProject !== null ||
    liveProjectError !== null;
  const layerVersionScope = `${sessionKey ?? ""}:${projectId}`;
  const [layerVersionSelection, setLayerVersionSelection] = useState<LayerVersionSelection>({
    scope: layerVersionScope,
  });
  const selectedLayerVersions =
    layerVersionSelection.scope === layerVersionScope ? layerVersionSelection : undefined;
  const commentsVersionId = selectedLayerVersions?.comments ?? projectVersionId;
  const flowsVersionId = selectedLayerVersions?.flows ?? projectVersionId;
  const selectLayerVersion = useCallback(
    (layer: VersionedLayer, versionId: string | undefined) => {
      setLayerVersionSelection((current) => ({
        ...(current.scope === layerVersionScope ? current : { scope: layerVersionScope }),
        [layer]: versionId,
      }));
    },
    [layerVersionScope],
  );

  const applyFlowPinEventRef = useRef<(event: StreamEvent) => void>(() => undefined);
  const forwardFlowPinEvent = useCallback(
    (event: StreamEvent) => applyFlowPinEventRef.current(event),
    [],
  );

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
    setCommentAddToContext,
    removeComment,
    setStatus,
    renameAnnotation,
    removeAnnotation,
  } = useAnnotationCollection({
    api,
    projectId,
    projectVersionId: commentsVersionId,
    pageKey,
    currentUser: activeUser,
    authenticated: teardownActive && projectVersionResolved,
    apiBaseUrl: activeConfig.apiBaseUrl,
    getAuthToken: activeConfig.getAuthToken,
    sessionKey: sessionKey ?? "",
    events: resolved,
    onFlowPinEvent: forwardFlowPinEvent,
  });

  const {
    annotations: allAnnotations,
    loading: allAnnotationsLoading,
    error: allAnnotationsError,
    reload: reloadAllAnnotations,
  } = useAllProjectAnnotations({
    api,
    apiBaseUrl: activeConfig.apiBaseUrl,
    projectId,
    projectVersionId: commentsVersionId,
    authenticated: teardownActive && projectVersionResolved,
    sessionKey,
  });

  const reloadAllAnnotationsRef = useRef(reloadAllAnnotations);
  reloadAllAnnotationsRef.current = reloadAllAnnotations;
  const annotationsLoadingRef = useRef(loading);
  useEffect(() => {
    const changedByPageLoad = annotationsLoadingRef.current || loading;
    annotationsLoadingRef.current = loading;
    if (changedByPageLoad) {
      return;
    }
    const timer = window.setTimeout(() => reloadAllAnnotationsRef.current(), 400);
    return () => window.clearTimeout(timer);
  }, [annotations, loading]);

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
  const revealHidListRef = useRef(false);
  useEffect(() => {
    if (
      selectedId &&
      !annotations.some((item) => item.id === selectedId) &&
      !allAnnotations.some((item) => item.id === selectedId)
    ) {
      setSelectedId(null);
    }
  }, [annotations, allAnnotations, selectedId]);
  const [draft, setDraft] = useState<DraftAnnotation | null>(null);
  const [discardPrompt, setDiscardPrompt] = useState<DiscardPrompt | null>(null);
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
  const [dataModelOpen, setDataModelOpen] = usePersistentState(
    `wpn-ui:${projectId}:dataModelOpen`,
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
  const [commentsFullScreenOpen, setCommentsFullScreenOpen] = useState(false);
  const [commentsFullScreenSelectedThreadId, setCommentsFullScreenSelectedThreadId] = useState<
    string | null
  >(null);

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
    applyAnnotationTagLocal,
    commitAnnotationTagUpdate,
    reloadAnnotationTags,
  } = useAnnotationTags({
    apiBaseUrl: activeConfig.apiBaseUrl,
    projectId,
    projectVersionId,
    pageKey,
    getAuthToken: activeConfig.getAuthToken,
    sessionKey,
    enabled: authenticated && projectVersionResolved,
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
    selectFlowPin: selectFlowPinRaw,
    applyFlowPinEvent,
    reloadFlowPins,
  } = useFlowPins({
    apiBaseUrl: activeConfig.apiBaseUrl,
    projectId,
    projectVersionId: flowsVersionId,
    pageKey,
    getAuthToken: activeConfig.getAuthToken,
    sessionKey,
    enabled: authenticated && projectVersionResolved,
  });

  applyFlowPinEventRef.current = applyFlowPinEvent;

  usePageVisitTracker({
    apiBaseUrl: activeConfig.apiBaseUrl,
    projectId,
    pageKey: basePageKey,
    enabled: isTrackingEnabled(resolved.trackPageVisits, authenticated),
    getAuthToken: activeConfig.getAuthToken,
    sessionKey: hostAuthenticated ? `host:${resolved.currentUser.id}` : sessionKey,
  });

  const selectFlowPin = useCallback(
    (id: string | null) => {
      if (id) {
        setListOpen(false);
        setSelectedId(null);
      }
      selectFlowPinRaw(id);
    },
    [selectFlowPinRaw, setListOpen],
  );

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

  const cancelTagDraftAndMode = useCallback(() => {
    cancelTagDraft();
    setTagHookModeEnabled(false);
  }, [cancelTagDraft, setTagHookModeEnabled]);

  const cancelFlowPinDraftAndMode = useCallback(() => {
    cancelFlowPinDraft();
    setFlowPinHookModeEnabled(false);
  }, [cancelFlowPinDraft, setFlowPinHookModeEnabled]);

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

  const closeOtherSurfaces = useCallback(
    (keep: "list" | "epicFlow" | "flow" | "dataModel" | "userManagement") => {
      if (keep !== "list") {
        setListOpen(false);
      }
      if (keep !== "epicFlow") {
        setEpicFlowOpen(false);
      }
      if (keep !== "flow") {
        setFlowOpen(false);
      }
      if (keep !== "dataModel") {
        setDataModelOpen(false);
      }
      if (keep !== "userManagement") {
        setUserManagementOpen(false);
      }
      setAuditHistoryOpen(false);
      selectFlowPin(null);
      setSelectedId(null);
    },
    [
      selectFlowPin,
      setAuditHistoryOpen,
      setDataModelOpen,
      setEpicFlowOpen,
      setFlowOpen,
      setListOpen,
      setUserManagementOpen,
    ],
  );
  const openListExclusive = useCallback(
    (open: boolean) => {
      setListOpen(open);
      if (open) {
        closeOtherSurfaces("list");
      }
    },
    [closeOtherSurfaces, setListOpen],
  );
  const openEpicFlowExclusive = useCallback(
    (open: boolean) => {
      setEpicFlowOpen(open);
      if (open) {
        closeOtherSurfaces("epicFlow");
      }
    },
    [closeOtherSurfaces, setEpicFlowOpen],
  );
  const openFlowExclusive = useCallback(
    (open: boolean) => {
      setFlowOpen(open);
      if (open) {
        closeOtherSurfaces("flow");
      }
    },
    [closeOtherSurfaces, setFlowOpen],
  );
  const openDataModelExclusive = useCallback(
    (open: boolean) => {
      setDataModelOpen(open);
      if (open) {
        closeOtherSurfaces("dataModel");
      }
    },
    [closeOtherSurfaces, setDataModelOpen],
  );
  const openUserManagementExclusive = useCallback(
    (open: boolean) => {
      setUserManagementOpen(open);
      if (open) {
        closeOtherSurfaces("userManagement");
      }
    },
    [closeOtherSurfaces, setUserManagementOpen],
  );

  const flowDirtyRef = useRef<Record<FlowEditorSource, boolean>>({ panel: false, pin: false });
  const [flowLeave, setFlowLeave] = useState<{
    source: FlowEditorSource;
    proceed: () => void;
  } | null>(null);
  const setFlowDirty = useCallback((source: FlowEditorSource, dirty: boolean) => {
    flowDirtyRef.current[source] = dirty;
  }, []);
  const guardFlowLeave = useCallback((scope: FlowEditorSource | "any", proceed: () => void) => {
    const dirty = flowDirtyRef.current;
    const source: FlowEditorSource | null =
      scope === "any"
        ? dirty.panel
          ? "panel"
          : dirty.pin
            ? "pin"
            : null
        : dirty[scope]
          ? scope
          : null;
    if (source) {
      setFlowLeave({ source, proceed });
      return;
    }
    proceed();
  }, []);
  const resolveFlowLeave = useCallback(
    (discard: boolean) => {
      setFlowLeave(null);
      if (discard && flowLeave) {
        flowDirtyRef.current[flowLeave.source] = false;
        flowLeave.proceed();
      }
    },
    [flowLeave],
  );
  const guardedSetListOpen = useCallback(
    (open: boolean) =>
      open ? guardFlowLeave("any", () => openListExclusive(true)) : openListExclusive(false),
    [guardFlowLeave, openListExclusive],
  );
  const guardedSetEpicFlowOpen = useCallback(
    (open: boolean) =>
      open
        ? guardFlowLeave("any", () => openEpicFlowExclusive(true))
        : openEpicFlowExclusive(false),
    [guardFlowLeave, openEpicFlowExclusive],
  );
  const guardedSetFlowOpen = useCallback(
    (open: boolean) => guardFlowLeave(open ? "pin" : "panel", () => openFlowExclusive(open)),
    [guardFlowLeave, openFlowExclusive],
  );
  const guardedSetDataModelOpen = useCallback(
    (open: boolean) =>
      open
        ? guardFlowLeave("any", () => openDataModelExclusive(true))
        : openDataModelExclusive(false),
    [guardFlowLeave, openDataModelExclusive],
  );
  const guardedSetUserManagementOpen = useCallback(
    (open: boolean) =>
      open
        ? guardFlowLeave("any", () => openUserManagementExclusive(true))
        : openUserManagementExclusive(false),
    [guardFlowLeave, openUserManagementExclusive],
  );
  const guardedSelectFlowPin = useCallback(
    (id: string | null) => guardFlowLeave("pin", () => selectFlowPin(id)),
    [guardFlowLeave, selectFlowPin],
  );

  const [referenceRequest, setReferenceRequest] = useState<ReferenceTarget | null>(null);
  const consumeReferenceRequest = useCallback(() => setReferenceRequest(null), []);
  const openReference = useCallback(
    (target: ReferenceTarget) => {
      setReferenceRequest(target);
      setCommentsFullScreenOpen(false);
      if (target.kind === "epic") {
        openEpicFlowExclusive(true);
      } else if (target.kind === "flow") {
        openFlowExclusive(true);
      } else {
        openDataModelExclusive(true);
      }
    },
    [openDataModelExclusive, openEpicFlowExclusive, openFlowExclusive],
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
    if (!revealHidListRef.current) {
      setSelectedId(null);
    }
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
      setDataModelOpen(false);
      setUserManagementOpen(false);
      setAuditHistoryOpen(false);
      setFlowPinHookModeEnabled(false);
      selectFlowPin(null);
    }
  }, [
    authenticated,
    selectFlowPin,
    setAuditHistoryOpen,
    setDataModelOpen,
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

  const startDraft = useCallback(
    (anchor: AnnotationAnchor, label: string) => {
      const number = nextNumber(annotationsRef.current);
      draftMessageRef.current = "";
      setSelectedId(null);
      setListOpen(false);
      selectFlowPin(null);
      const pageName = document.title.trim() || pageKey;
      setDraft({
        id: createClientId("draft"),
        label,
        path: `${pageName} > ${label}`,
        anchor,
        number,
        message: "",
      });
    },
    [pageKey, selectFlowPin, setListOpen],
  );

  const cancelDraft = useCallback(() => {
    clearDraft();
    setDiscardPrompt(null);
    setModeEnabledState(false);
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
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const pageName = current.path.split(" > ")[0] ?? trimmed;
      return {
        ...current,
        label: trimmed,
        path: `${pageName} > ${trimmed}`,
      };
    });
  }, []);

  const updateDraftPath = useCallback((path: string) => {
    setDraft((current) => (current ? { ...current, path } : current));
  }, []);

  const updateDraftMessage = useCallback((message: string) => {
    draftMessageRef.current = message;
  }, []);

  const currentUserId = activeConfig.currentUser.id;
  const submitDraft = useCallback(
    async (message: string, status?: AnnotationStatus, addToContext = false) => {
      const current = draftRef.current;
      if (!current) {
        return;
      }
      const created = await createAnnotation({
        projectId,
        projectVersionId: commentsVersionId,
        pageKey,
        path: current.path,
        anchor: current.anchor,
        comment: {
          message,
          authorId: currentUserId,
          addToContext,
        },
        status,
      });
      if (draftRef.current?.id === current.id) {
        clearDraft();
      }
      setModeEnabledState(false);
      setSelectedId(created.id);
      setPinsVisible(true);
    },
    [
      clearDraft,
      commentsVersionId,
      createAnnotation,
      currentUserId,
      pageKey,
      projectId,
      setPinsVisible,
    ],
  );

  const selectAnnotation = useCallback(
    (id: string | null) => {
      const proceed = () => {
        clearDraft();
        if (id) {
          setListOpen(false);
          selectFlowPin(null);
        }
        setSelectedId(id);
      };
      if (hasUnsavedDraft()) {
        setDiscardPrompt({ kind: "draft", proceed });
        return;
      }
      proceed();
    },
    [clearDraft, hasUnsavedDraft, selectFlowPin, setListOpen],
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
        }
      };
      if (hasUnsavedDraft()) {
        setDiscardPrompt({ kind: "draft", proceed });
        return;
      }
      proceed();
    },
    [clearDraft, hasUnsavedDraft, setPinsVisible],
  );

  const revealAnnotationAndHideList = useCallback(
    (id: string) => {
      revealHidListRef.current = true;
      revealAnnotation(id);
      setListOpen(false);
    },
    [revealAnnotation, setListOpen],
  );

  useEffect(() => {
    if (!selectedId) {
      revealHidListRef.current = false;
    }
  }, [selectedId]);

  const closeThread = useCallback(() => {
    const backToList = revealHidListRef.current;
    revealHidListRef.current = false;
    selectAnnotation(null);
    if (backToList) {
      setListOpen(true);
    }
  }, [selectAnnotation, setListOpen]);

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
      projectVersionId,
      reloadCurrentProjectVersion,
      project: liveProject,
      commentsVersionId,
      flowsVersionId,
      selectLayerVersion,
      pageKey,
      annotations,
      loading,
      error,
      connectionState,
      retry,
      allAnnotations,
      allAnnotationsLoading,
      allAnnotationsError,
      reloadAllAnnotations,
      actionError,
      clearActionError,
      createAnnotation,
      addComment,
      editComment,
      setCommentAddToContext,
      removeComment,
      setStatus,
      renameAnnotation,
      removeAnnotation,
      submitDraft,
      annotationTags,
      projectTags,
      submitTagDraft,
      removeAnnotationTag,
      applyAnnotationTagLocal,
      commitAnnotationTagUpdate,
      flowPins,
      syncFlowPinName,
      reloadFlowPins,
      reloadAnnotationTags,
    }),
    [
      activeConfig,
      api,
      projectVersionId,
      reloadCurrentProjectVersion,
      liveProject,
      commentsVersionId,
      flowsVersionId,
      selectLayerVersion,
      pageKey,
      annotations,
      loading,
      error,
      connectionState,
      retry,
      allAnnotations,
      allAnnotationsLoading,
      allAnnotationsError,
      reloadAllAnnotations,
      actionError,
      clearActionError,
      createAnnotation,
      addComment,
      editComment,
      setCommentAddToContext,
      removeComment,
      setStatus,
      renameAnnotation,
      removeAnnotation,
      submitDraft,
      annotationTags,
      projectTags,
      submitTagDraft,
      removeAnnotationTag,
      applyAnnotationTagLocal,
      commitAnnotationTagUpdate,
      flowPins,
      syncFlowPinName,
      reloadFlowPins,
      reloadAnnotationTags,
    ],
  );

  const uiValue = useMemo<AnnotationUiContextValue>(
    () => ({
      modeEnabled,
      setModeEnabled: setModeEnabledExclusive,
      selectedId,
      selectAnnotation,
      revealAnnotation,
      revealAnnotationAndHideList,
      closeThread,
      draft,
      startDraft,
      updateDraftLabel,
      updateDraftPath,
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
      cancelTagDraft: cancelTagDraftAndMode,
      flowPinModeEnabled,
      setFlowPinModeEnabled,
      flowPinsVisible,
      setFlowPinsVisible,
      flowPinDraft,
      startFlowPinDraft,
      cancelFlowPinDraft: cancelFlowPinDraftAndMode,
      submitFlowPinDraft,
      removeFlowPin,
      selectedFlowPinId,
      selectFlowPin: guardedSelectFlowPin,
      listOpen,
      setListOpen: guardedSetListOpen,
      epicFlowOpen,
      setEpicFlowOpen: guardedSetEpicFlowOpen,
      flowOpen,
      setFlowOpen: guardedSetFlowOpen,
      dataModelOpen,
      setDataModelOpen: guardedSetDataModelOpen,
      userManagementOpen,
      setUserManagementOpen: guardedSetUserManagementOpen,
      setFlowDirty,
      guardFlowLeave,
      flowLeaveRequest: flowLeave?.source ?? null,
      resolveFlowLeave,
      auditHistoryOpen,
      setAuditHistoryOpen,
      commentsFullScreenOpen,
      setCommentsFullScreenOpen,
      commentsFullScreenSelectedThreadId,
      setCommentsFullScreenSelectedThreadId,
      openReference,
      referenceRequest,
      consumeReferenceRequest,
    }),
    [
      modeEnabled,
      setModeEnabledExclusive,
      selectedId,
      selectAnnotation,
      revealAnnotation,
      revealAnnotationAndHideList,
      closeThread,
      draft,
      startDraft,
      updateDraftLabel,
      updateDraftPath,
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
      cancelTagDraftAndMode,
      flowPinModeEnabled,
      setFlowPinModeEnabled,
      flowPinsVisible,
      setFlowPinsVisible,
      flowPinDraft,
      startFlowPinDraft,
      cancelFlowPinDraftAndMode,
      submitFlowPinDraft,
      removeFlowPin,
      selectedFlowPinId,
      guardedSelectFlowPin,
      listOpen,
      guardedSetListOpen,
      epicFlowOpen,
      guardedSetEpicFlowOpen,
      flowOpen,
      guardedSetFlowOpen,
      dataModelOpen,
      guardedSetDataModelOpen,
      userManagementOpen,
      guardedSetUserManagementOpen,
      setFlowDirty,
      guardFlowLeave,
      flowLeave,
      resolveFlowLeave,
      auditHistoryOpen,
      setAuditHistoryOpen,
      commentsFullScreenOpen,
      setCommentsFullScreenOpen,
      commentsFullScreenSelectedThreadId,
      setCommentsFullScreenSelectedThreadId,
      openReference,
      referenceRequest,
      consumeReferenceRequest,
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

  const mergedContextValue = useMemo<AnnotationContextValue>(
    () => ({ ...dataValue, ...uiValue, ...authValue }),
    [dataValue, uiValue, authValue],
  );
  const annotationStoreRef = useRef<Store<AnnotationContextValue> | null>(null);
  if (!annotationStoreRef.current) {
    annotationStoreRef.current = new Store(mergedContextValue);
  }
  const annotationStore = annotationStoreRef.current;
  useEffect(() => {
    annotationStore.setState(mergedContextValue);
  }, [annotationStore, mergedContextValue]);

  return (
    <AnnotationAuthContext.Provider value={authValue}>
      <AnnotationDataContext.Provider value={dataValue}>
        <AnnotationUiContext.Provider value={uiValue}>
          <AnnotationStoreContext.Provider value={annotationStore}>
            <AiRuntimeProvider
              apiBaseUrl={activeConfig.apiBaseUrl}
              projectId={projectId}
              getAuthToken={activeConfig.getAuthToken}
              enabled={authenticated && activeConfig.ai?.enabled !== false}
              sessionKey={sessionKey}
              currentUserId={activeUser.id}
            >
              <AiUiProvider>
                <AnnotationViewContext.Provider value={viewContextValue}>
                  {children}
                </AnnotationViewContext.Provider>
                {portalReady && activeConfig.enabled
                  ? createPortal(
                      <AnnotationErrorBoundary>
                        <AnnotationLayer />
                      </AnnotationErrorBoundary>,
                      document.body,
                    )
                  : null}
              </AiUiProvider>
            </AiRuntimeProvider>
          </AnnotationStoreContext.Provider>
        </AnnotationUiContext.Provider>
      </AnnotationDataContext.Provider>
    </AnnotationAuthContext.Provider>
  );
}

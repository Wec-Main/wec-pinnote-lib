export { AnnotationProvider } from "./context/AnnotationProvider";
export type { AnnotationProviderProps } from "./context/AnnotationProvider";
export { DEFAULT_PINNOTE_API_URL, DEFAULT_USE_MOCK_API } from "./config/env";
export {
  useAnnotationContext,
  useAnnotationData,
  useAnnotationUi,
  useAnnotationAuth,
} from "./context/AnnotationContext";
export { useAnnotations } from "./hooks/useAnnotations";
export { useAnnotationMode } from "./hooks/useAnnotationMode";
export { useAnnotationApi } from "./hooks/useAnnotationApi";
export { useAnnotationPositions, useFloatingPanel } from "./hooks/useAnnotationPosition";
export { createAnnotationApi } from "./services/annotationApi";
export {
  AnnotationToggleButton,
  AnnotationModeButton,
  AnnotationVisibilityToggle,
} from "./components/AnnotationToggleButton";
export { AnnotationListPanel } from "./components/AnnotationListPanel";
export { AnnotationToolbar } from "./components/AnnotationToolbar";
export { UserManagementPanel } from "./components/UserManagement";
export { SettingsPanel } from "./components/Settings";
export { AuditHistoryPanel } from "./components/AuditHistory";
export { LoginDialog, ToolbarAuthControl } from "./components/Auth";
export {
  listDataModels,
  createDataModel,
  fetchDataModel,
  updateDataModel,
  deleteDataModel,
  fetchDataModelDocument,
  saveDataModelDocument,
  publishDataModel,
  listDataModelVersions,
  fetchDataModelVersion,
} from "./services/dataModelApi";
export type {
  DataModel,
  DataModelDocumentRecord,
  DataModelDraft,
  DataModelEngine,
  DataModelSummary,
  DataModelVersionDetail,
  DataModelVersionRecord,
  ErdCardinality,
  ErdDocumentJSON,
  ErdEntity,
  ErdEnum,
  ErdField,
  ErdIndex,
  ErdNote,
  ErdReferentialAction,
  ErdRelationship,
} from "./types/dataModel.types";
export { createAuthApi } from "./services/authApi";
export { useAuthSessions } from "./hooks/useAuthSessions";
export { useAnnotationStream } from "./hooks/useAnnotationStream";
export type { AnnotationStreamOptions } from "./hooks/useAnnotationStream";
export { applyStreamEvent } from "./utils/applyStreamEvent";
export type { StreamApplication } from "./utils/applyStreamEvent";
export { useEpicFlowStream } from "./hooks/useEpicFlowStream";
export type { EpicFlowStreamOptions } from "./hooks/useEpicFlowStream";
export { applyEpicFlowStreamEvent } from "./utils/applyEpicFlowStreamEvent";
export type { EpicFlowStreamApplication } from "./utils/applyEpicFlowStreamEvent";
export { createEpicFlowApi, EpicFlowApiError } from "./services/epicFlowApi";
export type { EpicFlowApiClient } from "./services/epicFlowApi";
export { useEpicFlowApi } from "./hooks/useEpicFlowApi";
export type { Epic, UserStory } from "./types/epicFlow.types";
export { fetchAuditPage } from "./services/auditApi";
export {
  fetchAnalyticsOverview,
  fetchAnalyticsPages,
  fetchAnalyticsVisits,
  downloadAnalyticsVisitsCsv,
} from "./services/analyticsApi";
export type {
  AnalyticsFilters,
  AnalyticsOverview,
  AnalyticsKpis,
  AnnotationStatusCounts,
  PageVisitRow as AnalyticsPageVisitRow,
  PageVisitPage,
  PagesQuery as AnalyticsPagesQuery,
  TrendDay,
  TopUserRecord,
  VisitRecord,
  VisitsPage,
  VisitsQuery as AnalyticsVisitsQuery,
  ExportVisitsQuery as AnalyticsExportVisitsQuery,
} from "./types/analytics.types";
export { rangeForPreset, validateCustomRange } from "./utils/analyticsRange";
export type { RangePreset, DateRange } from "./utils/analyticsRange";
export {
  createUser,
  deleteUser,
  fetchUsers,
  resetUserPassword,
  updateUser,
} from "./services/usersApi";
export {
  createOrganization,
  createProject,
  deleteOrganization,
  deleteProject,
  fetchOrganizations,
  fetchProject,
  fetchProjects,
  updateOrganization,
  updateProject,
} from "./services/organizationsApi";
export { AnnotationApiError } from "./types/annotation.types";
export type {
  Annotation,
  AnnotationAnchor,
  AnnotationApiClient,
  AnnotationComment,
  AnnotationConfig,
  AnnotationEventCallbacks,
  AnnotationListResponse,
  AnnotationStatus,
  AnnotationUser,
  CreateAnnotationRequest,
  CreateCommentRequest,
  DraftAnnotation,
  ResolvedAnnotationConfig,
  UpdateAnnotationRequest,
  UpdateCommentRequest,
} from "./types/annotation.types";
export type {
  AnnotationContextValue,
  AnnotationDataContextValue,
  AnnotationUiContextValue,
  AnnotationAuthContextValue,
} from "./context/AnnotationContext";
export type { AuthApiClient, AuthSession, LoginOption, RefreshedTokens } from "./types/auth.types";
export type { AuthSessionsValue } from "./hooks/useAuthSessions";
export type { AuditPage, AuditQuery, AuditRecord, AuditScope } from "./types/audit.types";
export type { CreatedUser, PasswordReset, UserListQuery, UserPage } from "./services/usersApi";
export type {
  Organization,
  OrganizationDraft,
  Project,
  ProjectDraft,
} from "./types/organization.types";
export type {
  StreamConnectionState,
  StreamEvent,
  StreamEventPayloads,
  StreamEventType,
} from "./types/stream.types";
export type {
  ManagedUser,
  ManagedUserDraft,
  UserManagementRole,
  UserManagementStatus,
} from "./types/userManagement.types";
export type {
  AnnotationTag,
  CreateAnnotationTagInput,
  DraftTagPin,
  UserPreferences,
} from "./types/annotationTag.types";
export { TAG_COLORS } from "./types/tag.types";
export type { ProjectTag, TagColor, TagDraft, TagStatus } from "./types/tag.types";
export {
  createAnnotationTag,
  deleteAnnotationTag,
  fetchAnnotationTags,
  fetchPreferences,
  saveTagsVisible,
} from "./services/annotationTagsApi";
export { createTag, deleteTag, fetchTags, updateTag } from "./services/tagsApi";
export { useAnnotationView } from "./hooks/useAnnotationView";
export { ANNOTATION_SCOPE_ATTRIBUTE } from "./utils/annotationScope";

export type * from "./types/ai.types";
export { AI_PROVIDERS, AI_ACTIVE_TURN_STATUSES } from "./types/ai.types";
export * from "./ai/ops";
export * from "./services/aiApi";
export { parseAiStreamEvent, AI_STREAM_EVENT_TYPES } from "./utils/aiStreamGuards";
export { canUseAi, canApplyAiModelOps, canManageAiTemplates } from "./utils/permissions";
export { useAiStream } from "./hooks/useAiStream";
export type { AiStreamOptions } from "./hooks/useAiStream";
export { useAiMe } from "./hooks/useAiMe";
export type { AiMeState } from "./hooks/useAiMe";
export { useAiSessions } from "./hooks/useAiSessions";
export type { AiSessionsState, UseAiSessionsOptions } from "./hooks/useAiSessions";
export { useAiSession } from "./hooks/useAiSession";
export type { AiSessionState } from "./hooks/useAiSession";
export {
  AiRuntimeProvider,
  AiRuntimeContext,
  useAiRuntime,
  useOptionalAiRuntime,
} from "./context/AiRuntimeContext";
export type { AiRuntimeContextValue, AiRuntimeProviderProps } from "./context/AiRuntimeContext";
export { AiStreamHub } from "./ai/AiStreamHub";
export type { AiStreamListener, AiReconnectListener } from "./ai/AiStreamHub";
export {
  EMPTY_AI_SESSION_VIEW,
  loadSessionDetail,
  prependMessages,
  reduceDraft,
  reduceSessionList,
  reduceSessionView,
  sessionMatchesFilter,
  sortSessions,
  selectDetail,
  messageList,
  upsertMessage,
  mergeMessages,
  markDraftStale,
  isSeqGap,
} from "./ai/sessionReducer";
export type {
  AiSessionFilter,
  AiSessionViewState,
  AiStreamingDraft,
  AiMessageStore,
  AiSessionMeta,
} from "./ai/sessionReducer";
export { aiSelectionStore, useAiCurrentSelection } from "./ai/aiSelectionStore";
export type { AiCurrentSelection } from "./ai/aiSelectionStore";
export {
  aiPreviewStore,
  createAiPreviewStore,
  aiPreviewKey,
  useAiPreview,
} from "./ai/aiPreviewStore";
export type {
  AiPreviewGhosts,
  AiPreviewOverlay,
  AiPreviewSnapshot,
  AiPreviewStore,
} from "./ai/aiPreviewStore";
export { useAiOpBatchApplier } from "./ai/useAiOpBatchApplier";
export type {
  AiBatchPreviewOutcome,
  AiOpBatchApplier,
  UseAiOpBatchApplierOptions,
} from "./ai/useAiOpBatchApplier";
export {
  applyBatchToDocument,
  buildPreviewOverlay,
  canTransitionOpBatch,
  describeOpErrors,
} from "./ai/opBatchApplier";
export {
  IntegrationsButton,
  AiFloatingButton,
  AiPanel,
  AiInlineBar,
  AiEditorDock,
  AiUiProvider,
  useAiUi,
  AiActivity,
  AiModelSwitcher,
  useAiAction,
  useWarmAi,
} from "./components/Ai";
export type {
  AiInlineBarProps,
  AiEditorDockProps,
  AiPanelRequest,
  AiUiContextValue,
  AiActivityProps,
  AiModelSwitcherProps,
  UseAiActionResult,
} from "./components/Ai";
export {
  runAiAction,
  warmAi,
  createSseParser,
  AiActionRequestError,
} from "./services/aiActionsStream";
export { useCachedResource } from "./hooks/useCachedResource";
export type { CachedResource, UseCachedResourceOptions } from "./hooks/useCachedResource";
export { useSkeletonGate, SKELETON_DELAY_MS, SKELETON_MIN_MS } from "./hooks/useSkeletonGate";
export {
  clearResources,
  fetchResource,
  invalidateResource,
  invalidateResources,
  mutateResource,
  notModified,
  prefetchResource,
  readResource,
  withEtag,
  writeResource,
} from "./utils/resourceCache";
export type { FetchContext, ResourceFetcher, ResourceSnapshot } from "./utils/resourceCache";
export {
  AI_ME_CACHE_KEY,
  AI_SESSIONS_CACHE_KEY,
  AI_TEMPLATES_CACHE_KEY,
  aiMeCacheKey,
  aiSessionsCacheKey,
  aiTemplatesCacheKey,
} from "./ai/cacheKeys";
export { prefetchAiActionTemplates, prefetchAiMe, prefetchAiSessions } from "./ai/prefetch";
export {
  Skeleton,
  SkeletonCard,
  SkeletonLines,
  SkeletonSlot,
  RefreshingIndicator,
} from "./components/primitives/Skeleton";

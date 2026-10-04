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
export { createAnnotationApi } from "./services/annotationService";
export { AnnotationToggleButton } from "./features/annotation/components/AnnotationToggleButton/AnnotationToggleButton";
export { AnnotationModeButton } from "./features/annotation/components/AnnotationToggleButton/AnnotationModeButton";
export { AnnotationVisibilityToggle } from "./features/annotation/components/AnnotationToggleButton/AnnotationVisibilityToggle";
export { AnnotationListPanel } from "./features/annotation/components/AnnotationListPanel/AnnotationListPanel";
export { AnnotationToolbar } from "./features/annotation/components/AnnotationToolbar/AnnotationToolbar";
export { UserManagementPanel } from "./features/userManagement/components/UserManagementPanel";
export { SettingsPanel } from "./features/settings/components/SettingsPanel";
export { AuditHistoryPanel } from "./features/auditHistory/components/AuditHistoryPanel";
export { LoginDialog } from "./features/auth/components/LoginDialog";
export { ToolbarAuthControl } from "./features/auth/components/ToolbarAuthControl";
export { WecFlowPanel } from "./features/flowchart/components/WecFlowPanel";
export { EpicFlowPanel } from "./features/epicFlow/components/EpicFlowPanel";
export { DataModelPanel } from "./features/erd/components/DataModelPanel";
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
} from "./services/erdService";
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
export { createAuthApi } from "./services/authService";
export { useAuthSessions } from "./hooks/useAuthSessions";
export { useAnnotationStream } from "./hooks/useAnnotationStream";
export type { AnnotationStreamOptions } from "./hooks/useAnnotationStream";
export { applyStreamEvent } from "./utils/annotation/applyStreamEvent";
export type { StreamApplication } from "./utils/annotation/applyStreamEvent";
export { useEpicFlowStream } from "./hooks/useEpicFlowStream";
export type { EpicFlowStreamOptions } from "./hooks/useEpicFlowStream";
export { applyEpicFlowStreamEvent } from "./utils/epicFlow/applyEpicFlowStreamEvent";
export type { EpicFlowStreamApplication } from "./utils/epicFlow/applyEpicFlowStreamEvent";
export { createEpicFlowApi, EpicFlowApiError } from "./services/epicFlowService";
export type { EpicFlowApiClient } from "./services/epicFlowService";
export { useEpicFlowApi } from "./hooks/useEpicFlowApi";
export type { Epic, UserStory } from "./types/epicFlow.types";
export { fetchAuditPage } from "./services/auditHistoryService";
export {
  fetchAnalyticsOverview,
  fetchAnalyticsPages,
  fetchAnalyticsVisits,
  downloadAnalyticsVisitsCsv,
} from "./services/analyticsService";
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
export { rangeForPreset, validateCustomRange } from "./utils/analytics/analyticsRange";
export type { RangePreset, DateRange } from "./utils/analytics/analyticsRange";
export {
  createUser,
  deleteUser,
  fetchUsers,
  resetUserPassword,
  updateUser,
} from "./services/userManagementService";
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
} from "./services/settingsService";
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
export type {
  CreatedUser,
  PasswordReset,
  UserListQuery,
  UserPage,
} from "./services/userManagementService";
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
} from "./services/annotationTagsService";
export { createTag, deleteTag, fetchTags, updateTag } from "./services/tagsService";
export { useAnnotationView } from "./hooks/useAnnotationView";
export { ANNOTATION_SCOPE_ATTRIBUTE } from "./utils/annotation/annotationScope";

export type * from "./types/ai.types";
export { AI_PROVIDERS, AI_ACTIVE_TURN_STATUSES } from "./types/ai.types";
export * from "./features/ai/ops";
export * from "./services/aiService";
export { parseAiStreamEvent, AI_STREAM_EVENT_TYPES } from "./utils/ai/aiStreamGuards";
export { canUseAi, canApplyAiModelOps, canManageAiTemplates } from "./utils/auth/permissions";
export { useAiStream } from "./hooks/useAiStream";
export type { AiStreamOptions, AiStreamReconnect } from "./hooks/useAiStream";
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
} from "./features/ai/AiRuntimeContext";
export type { AiRuntimeContextValue, AiRuntimeProviderProps } from "./features/ai/AiRuntimeContext";
export { AiStreamHub } from "./features/ai/AiStreamHub";
export type { AiStreamListener, AiReconnectListener } from "./features/ai/AiStreamHub";
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
} from "./features/ai/sessionReducer";
export type {
  AiSessionFilter,
  AiSessionViewState,
  AiStreamingDraft,
  AiMessageStore,
  AiSessionMeta,
} from "./features/ai/sessionReducer";
export { aiSelectionStore, useAiCurrentSelection } from "./features/ai/aiSelectionStore";
export type { AiCurrentSelection } from "./features/ai/aiSelectionStore";
export {
  aiPreviewStore,
  createAiPreviewStore,
  aiPreviewKey,
  useAiPreview,
} from "./features/ai/aiPreviewStore";
export type {
  AiPreviewGhosts,
  AiPreviewOverlay,
  AiPreviewSnapshot,
  AiPreviewStore,
} from "./features/ai/aiPreviewStore";
export { useAiOpBatchApplier } from "./features/ai/useAiOpBatchApplier";
export type {
  AiBatchPreviewOutcome,
  AiOpBatchApplier,
  UseAiOpBatchApplierOptions,
} from "./features/ai/useAiOpBatchApplier";
export {
  applyBatchToDocument,
  buildPreviewOverlay,
  canTransitionOpBatch,
  describeOpErrors,
} from "./features/ai/opBatchApplier";
export { IntegrationsButton } from "./features/ai/components/IntegrationsButton";
export { AiFloatingButton } from "./features/ai/components/AiFloatingButton";
export { AiPanel } from "./features/ai/components/AiPanel";
export { AiInlineBar } from "./features/ai/components/AiInlineBar";
export { AiEditorDock } from "./features/ai/components/AiEditorDock";
export { AiUiProvider, useAiUi } from "./features/ai/components/AiUiContext";
export { AiActivity } from "./features/ai/components/AiActivity";
export { AiModelSwitcher } from "./features/ai/components/AiModelSwitcher";
export { useAiAction, useWarmAi } from "./features/ai/components/useAiAction";
export type { AiInlineBarProps } from "./features/ai/components/AiInlineBar";
export type { AiEditorDockProps } from "./features/ai/components/AiEditorDock";
export type { AiPanelRequest, AiUiContextValue } from "./features/ai/components/AiUiContext";
export type { AiActivityProps } from "./features/ai/components/AiActivity";
export type { AiModelSwitcherProps } from "./features/ai/components/AiModelSwitcher";
export type { UseAiActionResult } from "./features/ai/components/useAiAction";
export {
  runAiAction,
  warmAi,
  createSseParser,
  AiActionRequestError,
} from "./services/aiActionsStreamService";
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
} from "./features/ai/cacheKeys";
export {
  prefetchAiActionTemplates,
  prefetchAiMe,
  prefetchAiSessions,
} from "./features/ai/prefetch";
export {
  Skeleton,
  SkeletonCard,
  SkeletonLines,
  SkeletonSlot,
  RefreshingIndicator,
} from "./components/primitives/Skeleton";

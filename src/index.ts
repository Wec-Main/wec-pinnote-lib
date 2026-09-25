export { AnnotationProvider } from "./context/AnnotationProvider";
export type { AnnotationProviderProps } from "./context/AnnotationProvider";
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
export { AnnotationToggleButton } from "./components/AnnotationToggleButton";
export { AnnotationListPanel } from "./components/AnnotationListPanel";
export { AnnotationToolbar } from "./components/AnnotationToolbar";
export { UserManagementPanel } from "./components/UserManagement";
export { SettingsPanel } from "./components/Settings";
export { AuditHistoryPanel } from "./components/AuditHistory";
export { LoginDialog, ToolbarAuthControl } from "./components/Auth";
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
  fetchAnalyticsSummary,
  fetchAnalyticsPages,
  fetchAnalyticsTrends,
  fetchAnalyticsUsers,
  fetchAnalyticsVisits,
  downloadAnalyticsVisitsCsv,
} from "./services/analyticsApi";
export type {
  AnalyticsFilters,
  AnalyticsSummary,
  AnnotationStatusCounts,
  PageVisitRow as AnalyticsPageVisitRow,
  PageVisitPage,
  PagesQuery as AnalyticsPagesQuery,
  TrendDay,
  AnalyticsTrends,
  TopUserRecord,
  TopUsersPage,
  UsersQuery as AnalyticsUsersQuery,
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
export type { AuthApiClient, AuthSession, LoginOption } from "./types/auth.types";
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

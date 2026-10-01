import { createContext, useContext } from "react";
import type { AuthSession, LoginOption } from "../types/auth.types";
import type { StreamConnectionState } from "../types/stream.types";
import type {
  Annotation,
  AnnotationAnchor,
  AnnotationApiClient,
  AnnotationStatus,
  CreateAnnotationRequest,
  DraftAnnotation,
  ResolvedAnnotationConfig,
} from "../types/annotation.types";
import type {
  AnnotationTag,
  DraftTagPin,
  UpdateAnnotationTagInput,
} from "../types/annotationTag.types";
import type { ProjectTag } from "../types/tag.types";
import type { Project } from "../types/organization.types";
import type { DraftFlowPin, FlowPin } from "../types/flowPin.types";

export type VersionedLayer = "comments" | "flows";

export interface DiscardPrompt {
  kind: "draft" | "edit";
  proceed: () => void;
}

export interface AnnotationDataContextValue {
  config: ResolvedAnnotationConfig;
  api: AnnotationApiClient;
  // The effective project version for every version-scoped fetch/create:
  // config.projectVersionId (an explicit host override) when set, otherwise
  // the project's live current_project_version_id, resolved fresh and
  // re-resolved whenever reloadCurrentProjectVersion() runs — e.g. after
  // Settings -> Versioning activates a different version. This is what a
  // component should read instead of config.projectVersionId directly.
  projectVersionId: string | undefined;
  reloadCurrentProjectVersion: () => void;
  project: Project | null;
  commentsVersionId: string | undefined;
  reloadFlowPins: () => void;
  reloadAnnotationTags: () => void;
  flowsVersionId: string | undefined;
  selectLayerVersion: (layer: VersionedLayer, versionId: string | undefined) => void;
  pageKey: string;
  annotations: Annotation[];
  loading: boolean;
  error: string | null;
  connectionState: StreamConnectionState;
  retry: () => void;
  // Every annotation across the whole project, regardless of page — used by
  // the toolbar comment count and the comments list panel. Refetched (not
  // live-streamed); see reloadAllAnnotations. Pin rendering, drafting, and
  // per-page live updates all continue to use `annotations` above.
  allAnnotations: Annotation[];
  allAnnotationsLoading: boolean;
  allAnnotationsError: string | null;
  reloadAllAnnotations: () => void;
  actionError: string | null;
  clearActionError: () => void;
  createAnnotation: (request: CreateAnnotationRequest) => Promise<Annotation>;
  addComment: (annotationId: string, message: string, replyToId?: string) => Promise<void>;
  editComment: (annotationId: string, commentId: string, message: string) => Promise<void>;
  removeComment: (annotationId: string, commentId: string) => Promise<void>;
  setStatus: (annotationId: string, status: AnnotationStatus) => Promise<void>;
  renameAnnotation: (annotationId: string, path: string) => Promise<void>;
  removeAnnotation: (annotationId: string) => Promise<void>;
  submitDraft: (message: string, status?: AnnotationStatus) => Promise<void>;
  annotationTags: AnnotationTag[];
  projectTags: ProjectTag[];
  submitTagDraft: (tagId: string) => Promise<void>;
  removeAnnotationTag: (annotationTagId: string) => Promise<void>;
  applyAnnotationTagLocal: (annotationTagId: string, patch: Partial<AnnotationTag>) => void;
  commitAnnotationTagUpdate: (
    annotationTagId: string,
    input: UpdateAnnotationTagInput,
  ) => Promise<void>;
  flowPins: FlowPin[];
  syncFlowPinName: (flowPinId: string, name: string) => void;
}

export interface AnnotationUiContextValue {
  modeEnabled: boolean;
  setModeEnabled: (enabled: boolean) => void;
  selectedId: string | null;
  selectAnnotation: (id: string | null) => void;
  revealAnnotation: (id: string) => void;
  // Reveals an annotation's on-page pin and temporarily hides the comments
  // list panel (whatever mode it's in) so the pin isn't obscured; the panel
  // reopens on its own once that pin's floating thread view is closed.
  revealAnnotationAndHideList: (id: string) => void;
  draft: DraftAnnotation | null;
  startDraft: (anchor: AnnotationAnchor, label: string) => void;
  updateDraftLabel: (label: string) => void;
  updateDraftPath: (path: string) => void;
  updateDraftMessage: (message: string) => void;
  cancelDraft: () => void;
  requestCancelDraft: () => void;
  discardPrompt: DiscardPrompt | null;
  confirmDiscard: () => void;
  cancelDiscardPrompt: () => void;
  pinsVisible: boolean;
  setPinsVisible: (visible: boolean) => void;
  tagModeEnabled: boolean;
  setTagModeEnabled: (enabled: boolean) => void;
  tagsVisible: boolean;
  setTagsVisible: (visible: boolean) => void;
  tagDraft: DraftTagPin | null;
  startTagDraft: (anchor: AnnotationAnchor, label: string) => void;
  cancelTagDraft: () => void;
  flowPinModeEnabled: boolean;
  setFlowPinModeEnabled: (enabled: boolean) => void;
  flowPinsVisible: boolean;
  setFlowPinsVisible: (visible: boolean) => void;
  flowPinDraft: DraftFlowPin | null;
  startFlowPinDraft: (anchor: AnnotationAnchor, label: string) => void;
  cancelFlowPinDraft: () => void;
  submitFlowPinDraft: (name: string) => Promise<void>;
  removeFlowPin: (flowPinId: string) => Promise<void>;
  selectedFlowPinId: string | null;
  selectFlowPin: (id: string | null) => void;
  listOpen: boolean;
  setListOpen: (open: boolean) => void;
  epicFlowOpen: boolean;
  setEpicFlowOpen: (open: boolean) => void;
  flowOpen: boolean;
  setFlowOpen: (open: boolean) => void;
  userManagementOpen: boolean;
  setUserManagementOpen: (open: boolean) => void;
  auditHistoryOpen: boolean;
  setAuditHistoryOpen: (open: boolean) => void;
  commentsFullScreenOpen: boolean;
  setCommentsFullScreenOpen: (open: boolean) => void;
  // Which thread the Full Screen comments view's right-side detail pane
  // shows — lifted out of that view's own component state (rather than a
  // local useState there) so it survives the view briefly unmounting, e.g.
  // while "open on page" temporarily hides the list to reveal a pin.
  commentsFullScreenSelectedThreadId: string | null;
  setCommentsFullScreenSelectedThreadId: (id: string | null) => void;
}

export interface AnnotationAuthContextValue {
  authenticated: boolean;
  hostAuthenticated: boolean;
  accounts: AuthSession[];
  activeAccount: AuthSession | null;
  loginOptions: LoginOption[];
  loginOptionsLoading: boolean;
  loginOptionsError: string | null;
  reloadLoginOptions: () => void;
  login: (userId: string, password: string) => Promise<void>;
  logout: (userId: string) => Promise<void>;
  switchAccount: (userId: string) => void;
  revokeError: string | null;
  clearRevokeError: () => void;
}

export type AnnotationContextValue = AnnotationDataContextValue &
  AnnotationUiContextValue &
  AnnotationAuthContextValue;

export const AnnotationDataContext = createContext<AnnotationDataContextValue | null>(null);
export const AnnotationUiContext = createContext<AnnotationUiContextValue | null>(null);
export const AnnotationAuthContext = createContext<AnnotationAuthContextValue | null>(null);

function requireContext<T>(value: T | null, name: string): T {
  if (!value) {
    throw new Error(`${name} must be used within AnnotationProvider`);
  }
  return value;
}

export function useAnnotationData(): AnnotationDataContextValue {
  return requireContext(useContext(AnnotationDataContext), "useAnnotationData");
}

export function useAnnotationUi(): AnnotationUiContextValue {
  return requireContext(useContext(AnnotationUiContext), "useAnnotationUi");
}

export function useAnnotationAuth(): AnnotationAuthContextValue {
  return requireContext(useContext(AnnotationAuthContext), "useAnnotationAuth");
}

export function useAnnotationContext(): AnnotationContextValue {
  const data = useAnnotationData();
  const ui = useAnnotationUi();
  const auth = useAnnotationAuth();
  return { ...data, ...ui, ...auth };
}

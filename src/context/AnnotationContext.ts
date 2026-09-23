import { createContext, useContext } from "react";
import type { AuthSession, LoginOption } from "../types/auth.types";
import type { StreamConnectionState } from "../types/stream.types";
import type {
  Annotation,
  AnnotationAnchor,
  AnnotationApiClient,
  AnnotationStatus,
  DraftAnnotation,
  PageStatus,
  ResolvedAnnotationConfig,
} from "../types/annotation.types";
import type { AnnotationTag, DraftTagPin } from "../types/annotationTag.types";
import type { ProjectTag } from "../types/tag.types";
import type { DraftFlowPin, FlowPin } from "../types/flowPin.types";
import type { FlowJSON } from "../components/WecFlow/flowchart";

export interface DiscardPrompt {
  kind: "draft" | "edit";
  proceed: () => void;
}

export interface AnnotationDataContextValue {
  config: ResolvedAnnotationConfig;
  api: AnnotationApiClient;
  pageKey: string;
  annotations: Annotation[];
  pageStatus: PageStatus;
  loading: boolean;
  error: string | null;
  connectionState: StreamConnectionState;
  retry: () => void;
  actionError: string | null;
  clearActionError: () => void;
  addComment: (annotationId: string, message: string) => Promise<void>;
  editComment: (annotationId: string, commentId: string, message: string) => Promise<void>;
  removeComment: (annotationId: string, commentId: string) => Promise<void>;
  setPageStatus: (status: PageStatus) => Promise<void>;
  setStatus: (annotationId: string, status: AnnotationStatus) => Promise<void>;
  removeAnnotation: (annotationId: string) => Promise<void>;
  submitDraft: (message: string, status?: AnnotationStatus) => Promise<void>;
  annotationTags: AnnotationTag[];
  projectTags: ProjectTag[];
  submitTagDraft: (tagId: string) => Promise<void>;
  removeAnnotationTag: (annotationTagId: string) => Promise<void>;
  flowPins: FlowPin[];
  updateFlowPinFlow: (flowPinId: string, flow: FlowJSON) => void;
}

export interface AnnotationUiContextValue {
  modeEnabled: boolean;
  setModeEnabled: (enabled: boolean) => void;
  selectedId: string | null;
  selectAnnotation: (id: string | null) => void;
  revealAnnotation: (id: string) => void;
  draft: DraftAnnotation | null;
  startDraft: (anchor: AnnotationAnchor, label: string) => void;
  updateDraftLabel: (label: string) => void;
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
  submitFlowPinDraft: (name: string) => void;
  removeFlowPin: (flowPinId: string) => void;
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
}

export interface AnnotationAuthContextValue {
  accounts: AuthSession[];
  activeAccount: AuthSession | null;
  loginOptions: LoginOption[];
  loginOptionsLoading: boolean;
  loginOptionsError: string | null;
  reloadLoginOptions: () => void;
  login: (userId: string, password: string) => Promise<void>;
  logout: (userId: string) => void;
  switchAccount: (userId: string) => void;
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

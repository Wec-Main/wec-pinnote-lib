import { createContext, useContext } from "react";
import type {
  Annotation,
  AnnotationAnchor,
  AnnotationApiClient,
  AnnotationStatus,
  DraftAnnotation,
  PageStatus,
  ResolvedAnnotationConfig,
} from "../types/annotation.types";

export interface AnnotationContextValue {
  config: ResolvedAnnotationConfig;
  api: AnnotationApiClient;
  pageKey: string;
  annotations: Annotation[];
  pageStatus: PageStatus;
  loading: boolean;
  error: string | null;
  retry: () => void;
  modeEnabled: boolean;
  setModeEnabled: (enabled: boolean) => void;
  selectedId: string | null;
  selectAnnotation: (id: string | null) => void;
  draft: DraftAnnotation | null;
  startDraft: (anchor: AnnotationAnchor, label: string) => void;
  updateDraftLabel: (label: string) => void;
  cancelDraft: () => void;
  submitDraft: (message: string, status?: AnnotationStatus) => Promise<void>;
  addComment: (annotationId: string, message: string) => Promise<void>;
  editComment: (annotationId: string, commentId: string, message: string) => Promise<void>;
  removeComment: (annotationId: string, commentId: string) => Promise<void>;
  setPageStatus: (status: PageStatus) => Promise<void>;
  setStatus: (annotationId: string, status: AnnotationStatus) => Promise<void>;
  removeAnnotation: (annotationId: string) => Promise<void>;
  authorName: string;
  setAuthorName: (name: string) => void;
  pinsVisible: boolean;
  setPinsVisible: (visible: boolean) => void;
  listOpen: boolean;
  setListOpen: (open: boolean) => void;
  epicFlowOpen: boolean;
  setEpicFlowOpen: (open: boolean) => void;
  actionError: string | null;
  clearActionError: () => void;
}

export const AnnotationContext = createContext<AnnotationContextValue | null>(null);

export function useAnnotationContext(): AnnotationContextValue {
  const value = useContext(AnnotationContext);
  if (!value) {
    throw new Error("Annotation hooks must be used within AnnotationProvider");
  }
  return value;
}

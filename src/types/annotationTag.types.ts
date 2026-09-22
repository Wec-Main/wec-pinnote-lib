import type { AnnotationAnchor } from "./annotation.types";

export interface AnnotationTag {
  id: string;
  organizationId: string;
  projectId: string;
  pageKey: string;
  tagId: string;
  tagName: string;
  tagColor: string;
  selector: string;
  elementIdentifier: string;
  relativeX: number;
  relativeY: number;
  fallbackX: number;
  fallbackY: number;
  viewportWidth: number;
  viewportHeight: number;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnnotationTagInput {
  projectId: string;
  pageKey: string;
  tagId: string;
  anchor: AnnotationAnchor;
}

export interface UserPreferences {
  projectId: string;
  tagsVisible: boolean;
}

/** A tag pin placed but not yet given a tag, held only in client state. */
export interface DraftTagPin {
  id: string;
  anchor: AnnotationAnchor;
  label: string;
}

import type { AnnotationAnchor } from "./annotation.types";

export const DEFAULT_TAG_PIN_WIDTH = 104;
export const DEFAULT_TAG_PIN_HEIGHT = 26;
export const MIN_TAG_PIN_WIDTH = 64;
export const MIN_TAG_PIN_HEIGHT = 22;

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
  width?: number;
  height?: number;
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

export interface UpdateAnnotationTagInput {
  tagId?: string;
  fallbackX?: number;
  fallbackY?: number;
  width?: number;
  height?: number;
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

import type { AnnotationAnchor } from "./annotation.types";
import type { FlowJSON } from "./flowchart.types";

export interface FlowPin {
  id: string;
  projectId: string;
  pageKey: string;
  flowId: string;
  name: string;
  anchor: AnnotationAnchor;
  createdById: string | null;
  createdByUser: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A flow pin placed but not yet named, held only in client state. */
export interface DraftFlowPin {
  id: string;
  anchor: AnnotationAnchor;
  label: string;
}

export interface FlowSummary {
  id: string;
  projectId: string;
  name: string;
  updatedAt: string;
}

/** A project-level flow, as listed/managed from the Flow browser. */
export interface Flow {
  id: string;
  projectId: string;
  name: string;
  description: string;
  status: string;
  createdByUser: string;
  createdById: string | null;
  updatedByUser: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FlowDocumentRecord {
  flow: FlowSummary;
  pageId: string | null;
  revision: number;
  document: FlowJSON;
}

export interface FlowVersionRecord {
  id: string;
  flowId: string;
  version: number;
  publishedById: string | null;
  publishedByUser: string | null;
  publishedAt: string;
}

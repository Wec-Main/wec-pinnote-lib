import type { AnnotationAnchor } from "./annotation.types";
import type { FlowJSON } from "../components/WecFlow/flowchart";

export interface FlowPin {
  id: string;
  projectId: string;
  pageKey: string;
  name: string;
  anchor: AnnotationAnchor;
  flow: FlowJSON;
  createdAt: string;
  updatedAt: string;
}

/** A flow pin placed but not yet named, held only in client state. */
export interface DraftFlowPin {
  id: string;
  anchor: AnnotationAnchor;
  label: string;
}

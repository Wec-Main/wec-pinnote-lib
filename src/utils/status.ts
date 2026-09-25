import type { AnnotationStatus } from "../types/annotation.types";

export const ANNOTATION_STATUS_OPTIONS: {
  value: AnnotationStatus;
  label: string;
  description: string;
}[] = [
  { value: "open", label: "Open", description: "New, waiting for triage" },
  { value: "re-open", label: "Re-Open", description: "Raised again after a fix" },
  { value: "dev-inprogress", label: "Dev-inprogress", description: "Being worked on" },
  { value: "completed", label: "Completed", description: "Fix delivered, ready to verify" },
  { value: "closed", label: "Closed", description: "No further action needed" },
];

export function statusLabel(status: AnnotationStatus): string {
  return ANNOTATION_STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status;
}

export function isDoneStatus(status: AnnotationStatus): boolean {
  return status === "completed" || status === "closed";
}

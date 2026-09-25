import type { AnnotationStatus } from "../types/annotation.types";

export const ANNOTATION_STATUS_OPTIONS: { value: AnnotationStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "re-open", label: "Re-Open" },
  { value: "dev-inprogress", label: "Dev-inprogress" },
  { value: "completed", label: "Completed" },
  { value: "closed", label: "Closed" },
];

export function statusLabel(status: AnnotationStatus): string {
  return ANNOTATION_STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status;
}

export function isDoneStatus(status: AnnotationStatus): boolean {
  return status === "completed" || status === "closed";
}

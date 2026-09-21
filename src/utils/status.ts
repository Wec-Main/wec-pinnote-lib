import type { AnnotationStatus, PageStatus } from "../types/annotation.types";

export const ANNOTATION_STATUS_OPTIONS: { value: AnnotationStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "re-open", label: "Re-Open" },
  { value: "dev-inprogress", label: "Dev-inprogress" },
  { value: "completed", label: "Completed" },
  { value: "closed", label: "Closed" },
];

export const PAGE_STATUS_OPTIONS: { value: PageStatus; label: string }[] = [
  { value: "review", label: "Review" },
  { value: "approved", label: "Approved" },
];

export function statusLabel(status: AnnotationStatus): string {
  return ANNOTATION_STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status;
}

export function pageStatusLabel(status: PageStatus): string {
  return PAGE_STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status;
}

export function isDoneStatus(status: AnnotationStatus): boolean {
  return status === "completed" || status === "closed";
}

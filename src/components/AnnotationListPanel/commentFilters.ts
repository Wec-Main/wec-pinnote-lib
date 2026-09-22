import type { Annotation, AnnotationComment, AnnotationStatus } from "../../types/annotation.types";
import { ANNOTATION_STATUS_OPTIONS, isDoneStatus } from "../../utils/status";
import type { SelectOption } from "../primitives";

export type CommentSort = "newest" | "oldest" | "pin" | "author";

export type CommentResolution = "all" | "open" | "resolved";

export interface CommentEntry {
  annotation: Annotation;
  comment: AnnotationComment;
  label: string;
  replyIndex: number;
  replyCount: number;
}

export interface CommentFilters {
  status: string;
  author: string;
  resolution: CommentResolution;
  sort: CommentSort;
  mineOnly: boolean;
}

export const DEFAULT_COMMENT_FILTERS: CommentFilters = {
  status: "",
  author: "",
  resolution: "all",
  sort: "newest",
  mineOnly: false,
};

export const SORT_OPTIONS: SelectOption[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "pin", label: "Pin number" },
  { value: "author", label: "Author A–Z" },
];

export const RESOLUTION_OPTIONS: SelectOption[] = [
  { value: "all", label: "All comments" },
  { value: "open", label: "Unresolved only" },
  { value: "resolved", label: "Resolved only" },
];

export function elementLabel(annotation: Annotation): string {
  return annotation.anchor.elementIdentifier.replace(/[-_]/g, " ");
}

export function toEntries(annotations: Annotation[]): CommentEntry[] {
  return annotations.flatMap((annotation) =>
    annotation.comments.map((comment, index) => ({
      annotation,
      comment,
      label: elementLabel(annotation),
      replyIndex: index,
      replyCount: annotation.comments.length,
    })),
  );
}

export function authorOptions(entries: CommentEntry[]): SelectOption[] {
  const byId = new Map<string, string>();
  for (const entry of entries) {
    byId.set(entry.comment.createdBy.id, entry.comment.createdBy.name);
  }
  return [...byId.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function statusOptions(entries: CommentEntry[]): SelectOption[] {
  const seen = new Set<AnnotationStatus>();
  for (const entry of entries) {
    seen.add(entry.annotation.status);
  }
  return ANNOTATION_STATUS_OPTIONS.filter((option) => seen.has(option.value)).map((option) => ({
    value: option.value,
    label: option.label,
  }));
}

function matchesResolution(entry: CommentEntry, resolution: CommentResolution): boolean {
  if (resolution === "all") {
    return true;
  }
  const done = isDoneStatus(entry.annotation.status);
  return resolution === "resolved" ? done : !done;
}

function compare(left: CommentEntry, right: CommentEntry, sort: CommentSort): number {
  if (sort === "oldest") {
    return left.comment.createdAt.localeCompare(right.comment.createdAt);
  }
  if (sort === "pin") {
    return (
      left.annotation.number - right.annotation.number ||
      left.comment.createdAt.localeCompare(right.comment.createdAt)
    );
  }
  if (sort === "author") {
    return (
      left.comment.createdBy.name.localeCompare(right.comment.createdBy.name) ||
      right.comment.createdAt.localeCompare(left.comment.createdAt)
    );
  }
  return right.comment.createdAt.localeCompare(left.comment.createdAt);
}

export function filterEntries(
  entries: CommentEntry[],
  filters: CommentFilters,
  currentUserId: string,
): CommentEntry[] {
  return entries
    .filter(
      (entry) =>
        matchesResolution(entry, filters.resolution) &&
        (!filters.status || entry.annotation.status === filters.status) &&
        (!filters.author || entry.comment.createdBy.id === filters.author) &&
        (!filters.mineOnly || entry.comment.createdBy.id === currentUserId),
    )
    .sort((left, right) => compare(left, right, filters.sort));
}

export function filtersActive(filters: CommentFilters): boolean {
  return (
    filters.status !== "" ||
    filters.author !== "" ||
    filters.resolution !== "all" ||
    filters.mineOnly ||
    filters.sort !== DEFAULT_COMMENT_FILTERS.sort
  );
}

export function groupByAnnotation(entries: CommentEntry[]): Map<string, CommentEntry[]> {
  const groups = new Map<string, CommentEntry[]>();
  for (const entry of entries) {
    const bucket = groups.get(entry.annotation.id);
    if (bucket) {
      bucket.push(entry);
    } else {
      groups.set(entry.annotation.id, [entry]);
    }
  }
  return groups;
}

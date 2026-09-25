import type { Annotation, AnnotationComment, AnnotationStatus } from "../../types/annotation.types";
import { ANNOTATION_STATUS_OPTIONS, isDoneStatus } from "../../utils/status";
import type { SelectOption } from "../primitives";

export type CommentSort = "newest" | "oldest" | "pin" | "author";

export type CommentResolution = "all" | "open" | "resolved";

export interface CommentThread {
  annotation: Annotation;
  label: string;
  root: AnnotationComment;
  replies: AnnotationComment[];
  lastActivityAt: string;
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
  { value: "newest", label: "Latest activity" },
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

export function toThreads(annotations: Annotation[]): CommentThread[] {
  return annotations.flatMap((annotation) => {
    const [root, ...replies] = annotation.comments;
    if (!root) {
      return [];
    }
    const lastActivityAt = annotation.comments.reduce(
      (latest, comment) => (comment.createdAt > latest ? comment.createdAt : latest),
      root.createdAt,
    );
    return [{ annotation, label: elementLabel(annotation), root, replies, lastActivityAt }];
  });
}

function threadComments(thread: CommentThread): AnnotationComment[] {
  return [thread.root, ...thread.replies];
}

export function authorOptions(threads: CommentThread[]): SelectOption[] {
  const byId = new Map<string, string>();
  for (const comment of threads.flatMap(threadComments)) {
    byId.set(comment.createdBy.id, comment.createdBy.name);
  }
  return [...byId.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function statusOptions(threads: CommentThread[]): SelectOption[] {
  const seen = new Set<AnnotationStatus>(threads.map((thread) => thread.annotation.status));
  return ANNOTATION_STATUS_OPTIONS.filter((option) => seen.has(option.value)).map((option) => ({
    value: option.value,
    label: option.label,
  }));
}

function matchesResolution(thread: CommentThread, resolution: CommentResolution): boolean {
  if (resolution === "all") {
    return true;
  }
  const done = isDoneStatus(thread.annotation.status);
  return resolution === "resolved" ? done : !done;
}

function hasCommentBy(thread: CommentThread, userId: string): boolean {
  return threadComments(thread).some((comment) => comment.createdBy.id === userId);
}

const COMPARATORS: Record<CommentSort, (left: CommentThread, right: CommentThread) => number> = {
  newest: (left, right) => right.lastActivityAt.localeCompare(left.lastActivityAt),
  oldest: (left, right) => left.root.createdAt.localeCompare(right.root.createdAt),
  pin: (left, right) => left.annotation.number - right.annotation.number,
  author: (left, right) =>
    left.root.createdBy.name.localeCompare(right.root.createdBy.name) ||
    right.lastActivityAt.localeCompare(left.lastActivityAt),
};

export function filterThreads(
  threads: CommentThread[],
  filters: CommentFilters,
  currentUserId: string,
): CommentThread[] {
  return threads
    .filter(
      (thread) =>
        matchesResolution(thread, filters.resolution) &&
        (!filters.status || thread.annotation.status === filters.status) &&
        (!filters.author || hasCommentBy(thread, filters.author)) &&
        (!filters.mineOnly || hasCommentBy(thread, currentUserId)),
    )
    .sort(COMPARATORS[filters.sort]);
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

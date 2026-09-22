export const TAG_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#10b981",
  "#0ea5e9",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#64748b",
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

export type TagStatus = "active" | "inactive";

export interface ProjectTag {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  color: string;
  status: TagStatus;
  createdById?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TagDraft {
  projectId: string;
  name: string;
  color: string;
  status: TagStatus;
}

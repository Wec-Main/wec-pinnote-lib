import type { AuditRecord } from "../../types/audit.types";

export interface ActionMeta {
  label: string;
  tone: "neutral" | "success" | "danger" | "warning";
}

const ACTION_META: Record<string, ActionMeta> = {
  "auth.login": { label: "Signed in", tone: "success" },
  "auth.login-failed": { label: "Sign-in failed", tone: "danger" },
  "auth.logout": { label: "Signed out", tone: "neutral" },
  "annotation.created": { label: "Annotation created", tone: "success" },
  "annotation.status-changed": { label: "Annotation status changed", tone: "warning" },
  "annotation.deleted": { label: "Annotation deleted", tone: "danger" },
  "comment.created": { label: "Comment added", tone: "success" },
  "comment.updated": { label: "Comment edited", tone: "warning" },
  "comment.deleted": { label: "Comment deleted", tone: "danger" },
  "page-status.updated": { label: "Page status updated", tone: "warning" },
  "user.created": { label: "User created", tone: "success" },
  "user.updated": { label: "User updated", tone: "warning" },
  "user.deleted": { label: "User deleted", tone: "danger" },
  "user.password-reset": { label: "Password reset", tone: "warning" },
  "organization.created": { label: "Organization created", tone: "success" },
  "organization.updated": { label: "Organization updated", tone: "warning" },
  "organization.deleted": { label: "Organization deleted", tone: "danger" },
  "project.created": { label: "Project created", tone: "success" },
  "project.updated": { label: "Project updated", tone: "warning" },
  "project.deleted": { label: "Project deleted", tone: "danger" },
};

const ENTITY_LABELS: Record<string, string> = {
  user: "User",
  annotation: "Annotation",
  annotation_comment: "Comment",
  page_status: "Page status",
  organization: "Organization",
  project: "Project",
};

export const ACTION_OPTIONS = Object.entries(ACTION_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

export const ENTITY_OPTIONS = Object.entries(ENTITY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function actionMeta(action: string): ActionMeta {
  return ACTION_META[action] ?? { label: action, tone: "neutral" };
}

export function entityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType;
}

export function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

export interface FieldChange {
  field: string;
  before: string | null;
  after: string | null;
}

const IGNORED_FIELDS = new Set(["updatedAt", "createdAt", "lastActiveAt"]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function humanizeToken(value: string): string {
  const spaced = value.replace(/[-_]/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function renderValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    if (ISO_DATE.test(value)) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
      }
    }
    return /^[a-z0-9]+([-_][a-z0-9]+)+$/.test(value) ? humanizeToken(value) : value;
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? null : `${value.length} item${value.length === 1 ? "" : "s"}`;
  }
  return null;
}

function humanizeField(field: string): string {
  const spaced = field.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_.]/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function flatten(value: unknown, prefix = ""): Record<string, unknown> {
  if (!isPlainRecord(value)) {
    return {};
  }
  const flat: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainRecord(nested)) {
      Object.assign(flat, flatten(nested, path));
    } else {
      flat[path] = nested;
    }
  }
  return flat;
}

export function diffFields(entry: AuditRecord): FieldChange[] {
  const before = flatten(entry.beforeData);
  const after = flatten(entry.afterData);
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => !IGNORED_FIELDS.has(key.split(".").pop() ?? key))
    .sort();

  const changes: FieldChange[] = [];
  for (const key of keys) {
    const previous = renderValue(before[key]);
    const next = renderValue(after[key]);
    if (previous === next) {
      continue;
    }
    changes.push({ field: humanizeField(key), before: previous, after: next });
  }
  return changes;
}

export function summarize(entry: AuditRecord): string {
  const parts: string[] = [];
  if (entry.pageKey) {
    parts.push(entry.pageKey);
  }
  if (entry.entityId) {
    parts.push(shortId(entry.entityId));
  }
  return parts.join(" · ");
}

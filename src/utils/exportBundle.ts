import type { Annotation } from "../types/annotation.types";
import type { DataModelDocumentRecord } from "../types/dataModel.types";
import type { Epic, UserStory } from "../types/epicFlow.types";
import type { FlowDocumentRecord } from "../types/flowPin.types";
import type { ProjectVersion } from "../types/projectVersion.types";
import { projectVersionLabel } from "./projectVersionLabel";

export interface ExportFile {
  filename: string;
  data: unknown;
}

export interface ExportBundleInput {
  version: ProjectVersion;
  annotations: Annotation[];
  flows: FlowDocumentRecord[];
  epics: Epic[];
  userStories: UserStory[];
  dataModels: DataModelDocumentRecord[];
  addToContextOnly: boolean;
}

/** Keeps only comments/replies flagged `addToContext`; drops threads left empty. */
export function filterAnnotationsForContext(annotations: Annotation[]): Annotation[] {
  return annotations.flatMap((annotation) => {
    const comments = annotation.comments.filter((comment) => comment.addToContext === true);
    return comments.length > 0 ? [{ ...annotation, comments }] : [];
  });
}

// Ownership/scoping ids and audit fields that mean nothing outside this
// deployment. Ids that link records together (comment replyToId, epicId, entity
// ids used by relations) are kept so the exported structure stays intact.
const EXPORT_OMITTED_KEYS = new Set([
  "organizationId",
  "projectId",
  "projectVersionId",
  "flowId",
  "dataModelId",
  "pageId",
  "createdById",
  "updatedById",
  "publishedById",
  "avatarUrl",
  "createdAt",
  "updatedAt",
  "addToContext",
]);

const EXPORT_USER_KEYS = new Set(["createdBy", "updatedBy", "publishedBy"]);

/** Recursively drops keys that are only useful inside the app, e.g. org/project ids. */
export function stripExportNoise(value: unknown, parentKey?: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripExportNoise(item, parentKey));
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  const isUser = parentKey !== undefined && EXPORT_USER_KEYS.has(parentKey);
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (EXPORT_OMITTED_KEYS.has(key) || (isUser && (key === "id" || key === "role"))) {
      continue;
    }
    result[key] = stripExportNoise(child, key);
  }
  return result;
}

/**
 * Context-flagged comments when any exist. `addToContext` defaults to false, so
 * filtering strictly would export an empty file for a project where nothing was
 * flagged; fall back to every comment then.
 */
function commentsForExport(annotations: Annotation[], contextOnly: boolean): Annotation[] {
  if (!contextOnly) {
    return annotations;
  }
  const flagged = filterAnnotationsForContext(annotations);
  return flagged.length > 0 ? flagged : annotations;
}

/** Filesystem-safe version token, e.g. "Version 2" -> "Version_2". */
export function exportVersionToken(version: ProjectVersion): string {
  const token = projectVersionLabel(version)
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return token || `v${version.versionNumber}`;
}

/**
 * Builds the four export files. Flows and comments are for the selected version
 * only (the caller fetches them that way); epics/stories and data models are
 * exported whole because they are not version-scoped and carry no context flag.
 */
export function buildExportFiles(input: ExportBundleInput): ExportFile[] {
  const token = exportVersionToken(input.version);
  const files: ExportFile[] = [
    {
      filename: `comments_${token}.json`,
      data: commentsForExport(input.annotations, input.addToContextOnly),
    },
    { filename: `flow_${token}.json`, data: input.flows },
    {
      filename: "draft_board.json",
      data: { epics: input.epics, userStories: input.userStories },
    },
    { filename: "datamodel.json", data: input.dataModels },
  ];
  return files.map((file) => ({ ...file, data: stripExportNoise(file.data) }));
}

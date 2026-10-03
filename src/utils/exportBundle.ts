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

export function filterAnnotationsForContext(annotations: Annotation[]): Annotation[] {
  return annotations.flatMap((annotation) => {
    const comments = annotation.comments.filter((comment) => comment.addToContext === true);
    return comments.length > 0 ? [{ ...annotation, comments }] : [];
  });
}

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

function commentsForExport(annotations: Annotation[], contextOnly: boolean): Annotation[] {
  if (!contextOnly) {
    return annotations;
  }
  const flagged = filterAnnotationsForContext(annotations);
  return flagged.length > 0 ? flagged : annotations;
}

export function exportVersionToken(version: ProjectVersion): string {
  const token = projectVersionLabel(version)
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return token || `v${version.versionNumber}`;
}

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

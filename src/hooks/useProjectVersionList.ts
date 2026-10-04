import { useAnnotationContext } from "../context/AnnotationContext";
import { createProjectVersionsApi } from "../services/versioningService";
import type { ProjectVersion } from "../types/projectVersion.types";
import { useSharedFetch } from "./useSharedFetch";

export function projectVersionListKey(
  apiBaseUrl: string,
  accountId: string,
  projectId: string,
): string {
  return `project-versions:${apiBaseUrl}:${accountId}:${projectId}`;
}

export function useProjectVersionList(enabled: boolean) {
  const { config, activeAccount } = useAnnotationContext();
  const key =
    enabled && activeAccount
      ? projectVersionListKey(config.apiBaseUrl, activeAccount.id, config.projectId)
      : null;
  const { data, error, reload } = useSharedFetch<ProjectVersion[]>(key, (signal) =>
    createProjectVersionsApi(config).listProjectVersions(config.projectId, signal),
  );
  return { versions: data, error, reload };
}

import type { ProjectVersion } from "../types/projectVersion.types";

export function projectVersionLabel(version: ProjectVersion): string {
  return version.name && version.name.trim().length > 0
    ? version.name
    : `Version ${version.versionNumber}`;
}

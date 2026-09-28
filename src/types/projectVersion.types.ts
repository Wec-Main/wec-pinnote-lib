export type ProjectVersionStatus = "draft" | "published" | "archived";

export interface ProjectVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  name?: string;
  status: ProjectVersionStatus;
  createdById?: string;
  publishedById?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectVersionRequest {
  name?: string;
}

export interface UpdateProjectVersionRequest {
  name?: string;
  status?: ProjectVersionStatus;
  setCurrent?: boolean;
}

export interface ProjectVersionApiClient {
  listProjectVersions(projectId: string, signal?: AbortSignal): Promise<ProjectVersion[]>;
  getProjectVersion(
    projectId: string,
    projectVersionId: string,
    signal?: AbortSignal,
  ): Promise<ProjectVersion>;
  createProjectVersion(
    projectId: string,
    request: CreateProjectVersionRequest,
    signal?: AbortSignal,
  ): Promise<ProjectVersion>;
  updateProjectVersion(
    projectId: string,
    projectVersionId: string,
    request: UpdateProjectVersionRequest,
    signal?: AbortSignal,
  ): Promise<ProjectVersion>;
}

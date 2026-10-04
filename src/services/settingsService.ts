import { createApiClient } from "./apiClientFactory";
import type {
  Organization,
  OrganizationDraft,
  Project,
  ProjectDraft,
} from "../types/organization.types";

export async function fetchOrganizations(
  apiBaseUrl: string,
  authToken: string | undefined,
  signal?: AbortSignal,
): Promise<Organization[]> {
  const payload = await createApiClient(apiBaseUrl, authToken).call<{
    organizations: Organization[];
  }>("/organizations", { signal });
  return payload.organizations;
}

export function createOrganization(
  apiBaseUrl: string,
  authToken: string | undefined,
  draft: OrganizationDraft,
  signal?: AbortSignal,
): Promise<Organization> {
  return createApiClient(apiBaseUrl, authToken).call<Organization>("/organizations", {
    method: "POST",
    body: draft,
    signal,
  });
}

export function updateOrganization(
  apiBaseUrl: string,
  authToken: string | undefined,
  organizationId: string,
  draft: OrganizationDraft,
  signal?: AbortSignal,
): Promise<Organization> {
  return createApiClient(apiBaseUrl, authToken).call<Organization>(
    `/organizations/${encodeURIComponent(organizationId)}`,
    { method: "PUT", body: draft, signal },
  );
}

export function deleteOrganization(
  apiBaseUrl: string,
  authToken: string | undefined,
  organizationId: string,
  signal?: AbortSignal,
): Promise<void> {
  return createApiClient(apiBaseUrl, authToken).callNoContent(
    `/organizations/${encodeURIComponent(organizationId)}`,
    { method: "DELETE", signal },
  );
}

export async function fetchProjects(
  apiBaseUrl: string,
  authToken: string | undefined,
  organizationId?: string,
  signal?: AbortSignal,
): Promise<Project[]> {
  const payload = await createApiClient(apiBaseUrl, authToken).call<{ projects: Project[] }>(
    "/projects",
    { query: { organizationId }, signal },
  );
  return payload.projects;
}

export function fetchProject(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  signal?: AbortSignal,
): Promise<Project> {
  return createApiClient(apiBaseUrl, authToken).call<Project>(
    `/projects/${encodeURIComponent(projectId)}`,
    { signal },
  );
}

export function createProject(
  apiBaseUrl: string,
  authToken: string | undefined,
  draft: ProjectDraft,
  signal?: AbortSignal,
): Promise<Project> {
  return createApiClient(apiBaseUrl, authToken).call<Project>("/projects", {
    method: "POST",
    body: draft,
    signal,
  });
}

export function updateProject(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  draft: ProjectDraft,
  signal?: AbortSignal,
): Promise<Project> {
  return createApiClient(apiBaseUrl, authToken).call<Project>(
    `/projects/${encodeURIComponent(projectId)}`,
    { method: "PUT", body: draft, signal },
  );
}

export interface ProjectVersionSettingsPatch {
  annotationVersioningEnabled?: boolean;
  tagVersioningEnabled?: boolean;
  flowVersioningEnabled?: boolean;
}

export function updateProjectVersionSettings(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  patch: ProjectVersionSettingsPatch,
  signal?: AbortSignal,
): Promise<Project> {
  return createApiClient(apiBaseUrl, authToken).call<Project>(
    `/projects/${encodeURIComponent(projectId)}/version-settings`,
    { method: "PATCH", body: patch, signal },
  );
}

export function deleteProject(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  signal?: AbortSignal,
): Promise<void> {
  return createApiClient(apiBaseUrl, authToken).callNoContent(
    `/projects/${encodeURIComponent(projectId)}`,
    { method: "DELETE", signal },
  );
}

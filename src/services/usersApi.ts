import { buildUrl, request } from "./httpClient";
import type { ManagedUser, ManagedUserDraft } from "../types/userManagement.types";

export interface UserListQuery {
  projectId: string;
  search?: string;
  roleId?: string;
  status?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

export interface UserPage {
  users: ManagedUser[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreatedUser {
  user: ManagedUser;
  generatedPassword?: string;
}

export interface PasswordReset {
  user: ManagedUser;
  password: string;
}

function usersQuery(query: UserListQuery): Record<string, string | undefined> {
  return {
    projectId: query.projectId,
    search: query.search,
    roleId: query.roleId,
    status: query.status,
    category: query.category,
    limit: query.limit !== undefined ? String(query.limit) : undefined,
    offset: query.offset !== undefined ? String(query.offset) : undefined,
  };
}

export function fetchUsers(
  apiBaseUrl: string,
  authToken: string | undefined,
  query: UserListQuery,
  signal?: AbortSignal,
): Promise<UserPage> {
  return request<UserPage>(buildUrl(apiBaseUrl, "/users", usersQuery(query)), authToken, {
    signal,
  });
}

function toPayload(projectId: string, draft: ManagedUserDraft) {
  const phone = draft.phone.trim();
  return { ...draft, projectId, phone: phone || undefined };
}

function toUpdatePayload(projectId: string, draft: ManagedUserDraft) {
  const { password: _password, ...rest } = toPayload(projectId, draft);
  return rest;
}

export function createUser(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  draft: ManagedUserDraft,
  signal?: AbortSignal,
): Promise<CreatedUser> {
  return request<CreatedUser>(buildUrl(apiBaseUrl, "/users"), authToken, {
    method: "POST",
    body: JSON.stringify(toPayload(projectId, draft)),
    signal,
  });
}

export function updateUser(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  userId: string,
  draft: ManagedUserDraft,
  signal?: AbortSignal,
): Promise<ManagedUser> {
  return request<ManagedUser>(
    buildUrl(apiBaseUrl, `/users/${encodeURIComponent(userId)}`),
    authToken,
    {
      method: "PUT",
      body: JSON.stringify(toUpdatePayload(projectId, draft)),
      signal,
    },
  );
}

export function deleteUser(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<void> {
  return request<void>(
    buildUrl(apiBaseUrl, `/users/${encodeURIComponent(userId)}`, { projectId }),
    authToken,
    {
      method: "DELETE",
      signal,
    },
  );
}

export function resetUserPassword(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  userId: string,
  password?: string,
  signal?: AbortSignal,
): Promise<PasswordReset> {
  return request<PasswordReset>(
    buildUrl(apiBaseUrl, `/users/${encodeURIComponent(userId)}/password-reset`),
    authToken,
    { method: "POST", body: JSON.stringify({ projectId, password }), signal },
  );
}

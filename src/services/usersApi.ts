import { buildUrl, request, requestNoContent, withUnauthorizedRetry } from "./httpClient";
import type { ManagedUser, ManagedUserDraft } from "../types/userManagement.types";

type AuthTokenGetter = () => string | Promise<string>;

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
  getAuthToken: AuthTokenGetter | undefined,
  query: UserListQuery,
  signal?: AbortSignal,
): Promise<UserPage> {
  const url = buildUrl(apiBaseUrl, "/users", usersQuery(query));
  return withUnauthorizedRetry(getAuthToken, (token) =>
    request<UserPage>(url, token, { signal }),
  );
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
  getAuthToken: AuthTokenGetter | undefined,
  projectId: string,
  draft: ManagedUserDraft,
  signal?: AbortSignal,
): Promise<CreatedUser> {
  const url = buildUrl(apiBaseUrl, "/users");
  return withUnauthorizedRetry(getAuthToken, (token) =>
    request<CreatedUser>(url, token, {
      method: "POST",
      body: JSON.stringify(toPayload(projectId, draft)),
      signal,
    }),
  );
}

export function updateUser(
  apiBaseUrl: string,
  getAuthToken: AuthTokenGetter | undefined,
  projectId: string,
  userId: string,
  draft: ManagedUserDraft,
  signal?: AbortSignal,
): Promise<ManagedUser> {
  const url = buildUrl(apiBaseUrl, `/users/${encodeURIComponent(userId)}`);
  return withUnauthorizedRetry(getAuthToken, (token) =>
    request<ManagedUser>(url, token, {
      method: "PUT",
      body: JSON.stringify(toUpdatePayload(projectId, draft)),
      signal,
    }),
  );
}

export function deleteUser(
  apiBaseUrl: string,
  getAuthToken: AuthTokenGetter | undefined,
  projectId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<void> {
  const url = buildUrl(apiBaseUrl, `/users/${encodeURIComponent(userId)}`, { projectId });
  return withUnauthorizedRetry(getAuthToken, (token) =>
    requestNoContent(url, token, { method: "DELETE", signal }),
  );
}

export function resetUserPassword(
  apiBaseUrl: string,
  getAuthToken: AuthTokenGetter | undefined,
  projectId: string,
  userId: string,
  password?: string,
  signal?: AbortSignal,
): Promise<PasswordReset> {
  const url = buildUrl(apiBaseUrl, `/users/${encodeURIComponent(userId)}/password-reset`);
  return withUnauthorizedRetry(getAuthToken, (token) =>
    request<PasswordReset>(url, token, {
      method: "POST",
      body: JSON.stringify({ projectId, password }),
      signal,
    }),
  );
}

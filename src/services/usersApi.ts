import { createApiClient, type AuthTokenGetter } from "./apiClientFactory";
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
  getAuthToken: AuthTokenGetter | undefined,
  query: UserListQuery,
  signal?: AbortSignal,
): Promise<UserPage> {
  return createApiClient(apiBaseUrl, getAuthToken).call<UserPage>("/users", {
    query: usersQuery(query),
    signal,
  });
}

export interface MentionCandidateRecord {
  id: string;
  name: string;
  avatarUrl?: string;
}

export function fetchMentionCandidates(
  apiBaseUrl: string,
  getAuthToken: AuthTokenGetter | undefined,
  projectId: string,
  signal?: AbortSignal,
): Promise<MentionCandidateRecord[]> {
  return createApiClient(apiBaseUrl, getAuthToken)
    .call<{ users: MentionCandidateRecord[] }>("/users/mention-candidates", {
      query: { projectId },
      signal,
    })
    .then((page) => page.users);
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
  return createApiClient(apiBaseUrl, getAuthToken).call<CreatedUser>("/users", {
    method: "POST",
    body: toPayload(projectId, draft),
    signal,
  });
}

export function updateUser(
  apiBaseUrl: string,
  getAuthToken: AuthTokenGetter | undefined,
  projectId: string,
  userId: string,
  draft: ManagedUserDraft,
  signal?: AbortSignal,
): Promise<ManagedUser> {
  return createApiClient(apiBaseUrl, getAuthToken).call<ManagedUser>(
    `/users/${encodeURIComponent(userId)}`,
    {
      method: "PUT",
      body: toUpdatePayload(projectId, draft),
      signal,
    },
  );
}

export function deleteUser(
  apiBaseUrl: string,
  getAuthToken: AuthTokenGetter | undefined,
  projectId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<void> {
  return createApiClient(apiBaseUrl, getAuthToken).callNoContent(
    `/users/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      query: { projectId },
      signal,
    },
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
  return createApiClient(apiBaseUrl, getAuthToken).call<PasswordReset>(
    `/users/${encodeURIComponent(userId)}/password-reset`,
    {
      method: "POST",
      body: { projectId, password },
      signal,
    },
  );
}

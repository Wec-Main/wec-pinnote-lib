import { AnnotationApiError } from "../types/annotation.types";
import { actorHeaders } from "./actorIdentity";
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

function usersUrl(
  apiBaseUrl: string,
  path = "",
  query?: Record<string, string | number | undefined>,
): string {
  const base = apiBaseUrl.replace(/\/+$/, "");
  const url = new URL(`${base}/users${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function request<T>(url: string, actorId: string | undefined, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...actorHeaders(actorId),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = `Request failed (${response.status})`;
    try {
      const parsed = JSON.parse(text) as { message?: string };
      message = parsed.message ?? message;
    } catch {
      if (text) {
        message = text;
      }
    }
    throw new AnnotationApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export function fetchUsers(
  apiBaseUrl: string,
  actorId: string | undefined,
  query: UserListQuery,
  signal?: AbortSignal,
): Promise<UserPage> {
  return request<UserPage>(usersUrl(apiBaseUrl, "", { ...query }), actorId, { signal });
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
  actorId: string | undefined,
  projectId: string,
  draft: ManagedUserDraft,
  signal?: AbortSignal,
): Promise<CreatedUser> {
  return request<CreatedUser>(usersUrl(apiBaseUrl), actorId, {
    method: "POST",
    body: JSON.stringify(toPayload(projectId, draft)),
    signal,
  });
}

export function updateUser(
  apiBaseUrl: string,
  actorId: string | undefined,
  projectId: string,
  userId: string,
  draft: ManagedUserDraft,
  signal?: AbortSignal,
): Promise<ManagedUser> {
  return request<ManagedUser>(usersUrl(apiBaseUrl, `/${encodeURIComponent(userId)}`), actorId, {
    method: "PUT",
    body: JSON.stringify(toUpdatePayload(projectId, draft)),
    signal,
  });
}

export function deleteUser(
  apiBaseUrl: string,
  actorId: string | undefined,
  projectId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<void> {
  return request<void>(usersUrl(apiBaseUrl, `/${encodeURIComponent(userId)}`, { projectId }), actorId, {
    method: "DELETE",
    signal,
  });
}

export function resetUserPassword(
  apiBaseUrl: string,
  actorId: string | undefined,
  projectId: string,
  userId: string,
  password?: string,
  signal?: AbortSignal,
): Promise<PasswordReset> {
  return request<PasswordReset>(
    usersUrl(apiBaseUrl, `/${encodeURIComponent(userId)}/password-reset`),
    actorId,
    { method: "POST", body: JSON.stringify({ projectId, password }), signal },
  );
}

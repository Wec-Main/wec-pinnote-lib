import { AnnotationApiError } from "../types/annotation.types";
import { actorHeaders } from "./actorIdentity";
import type { AuthApiClient, AuthSession, LoginOption } from "../types/auth.types";

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

async function readError(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  if (!text) {
    return `Request failed (${response.status})`;
  }
  try {
    const payload = JSON.parse(text) as { error?: string; message?: string };
    return payload.error ?? payload.message ?? text;
  } catch {
    return text;
  }
}

export function createAuthApi(apiBaseUrl: string): AuthApiClient {
  return {
    async listLoginOptions(projectId, signal) {
      const query = new URLSearchParams({ projectId });
      const response = await fetch(joinUrl(apiBaseUrl, `/auth/users?${query.toString()}`), {
        headers: { Accept: "application/json" },
        signal,
      });
      if (!response.ok) {
        throw new AnnotationApiError(await readError(response), response.status);
      }
      const payload = (await response.json()) as { users: LoginOption[] };
      return payload.users;
    },

    async login(projectId, userId, password, signal) {
      const response = await fetch(joinUrl(apiBaseUrl, "/auth/login"), {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, userId, password }),
        signal,
      });
      if (!response.ok) {
        throw new AnnotationApiError(
          response.status === 401 ? "Incorrect password." : await readError(response),
          response.status,
        );
      }
      const payload = (await response.json()) as {
        user: Omit<AuthSession, "token" | "refreshToken">;
        token: string;
        refreshToken: string;
      };
      return { ...payload.user, token: payload.token, refreshToken: payload.refreshToken };
    },

    async logout(projectId, userId, signal, token) {
      const response = await fetch(joinUrl(apiBaseUrl, "/auth/logout"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...actorHeaders(token) },
        body: JSON.stringify({ projectId, userId }),
        signal,
      });
      if (!response.ok) {
        throw new AnnotationApiError(await readError(response), response.status);
      }
    },

    async refresh(projectId, refreshToken, signal) {
      const response = await fetch(joinUrl(apiBaseUrl, "/auth/refresh"), {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, refreshToken }),
        signal,
      });
      if (!response.ok) {
        throw new AnnotationApiError(await readError(response), response.status);
      }
      const payload = (await response.json()) as { token: string };
      return payload.token;
    },
  };
}

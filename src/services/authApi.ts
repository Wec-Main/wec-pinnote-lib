import { AnnotationApiError } from "../types/annotation.types";
import { buildUrl, request, requestNoContent } from "./httpClient";
import { isSession } from "../utils/authSession";
import type { AuthApiClient, AuthSession, LoginOption } from "../types/auth.types";

function loginFallbackMessage(status: number): string {
  return status === 401 ? "Incorrect password." : `Request failed (${status})`;
}

export function createAuthApi(apiBaseUrl: string): AuthApiClient {
  return {
    async listLoginOptions(projectId, signal) {
      const url = buildUrl(apiBaseUrl, "/auth/users", { projectId });
      const payload = await request<{ users: LoginOption[] }>(
        url,
        undefined,
        { signal },
        { reportUnauthorized: false },
      );
      if (!Array.isArray(payload.users)) {
        throw new AnnotationApiError("Malformed login options response", 200, null);
      }
      return payload.users;
    },

    async login(projectId, userId, password, signal) {
      const url = buildUrl(apiBaseUrl, "/auth/login");
      const payload = await request<{
        user: Omit<AuthSession, "token" | "refreshToken">;
        token: string;
        refreshToken: string;
      }>(
        url,
        undefined,
        {
          method: "POST",
          body: JSON.stringify({ projectId, userId, password }),
          signal,
        },
        { reportUnauthorized: false, fallbackMessage: loginFallbackMessage },
      );
      const session = { ...payload.user, token: payload.token, refreshToken: payload.refreshToken };
      if (!isSession(session)) {
        throw new AnnotationApiError("Malformed login response", 200, null);
      }
      return session;
    },

    async logout(projectId, userId, signal, token) {
      const url = buildUrl(apiBaseUrl, "/auth/logout");
      await requestNoContent(
        url,
        token,
        {
          method: "POST",
          body: JSON.stringify({ projectId, userId }),
          signal,
        },
        { reportUnauthorized: false },
      );
    },

    async refresh(projectId, refreshToken, signal) {
      const url = buildUrl(apiBaseUrl, "/auth/refresh");
      const payload = await request<{ token: string }>(
        url,
        undefined,
        {
          method: "POST",
          body: JSON.stringify({ projectId, refreshToken }),
          signal,
        },
        { reportUnauthorized: false },
      );
      if (typeof payload.token !== "string" || payload.token.length === 0) {
        throw new AnnotationApiError("Malformed refresh response", 200, null);
      }
      return payload.token;
    },
  };
}

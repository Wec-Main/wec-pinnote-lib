import type { Epic, EpicFlowFormInput, UserStory } from "../types/epicFlow.types";

export class EpicFlowApiError extends Error {
  readonly status: number;
  readonly body: string | null;

  constructor(message: string, status: number, body: string | null = null) {
    super(message);
    this.name = "EpicFlowApiError";
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string>;
  body?: unknown;
}

function joinUrl(baseUrl: string, path: string, query?: Record<string, string>): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const url = new URL(`${normalizedBase}${path}`, "http://local.invalid");
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }
  if (/^https?:\/\//i.test(normalizedBase)) {
    return url.toString();
  }
  return `${url.pathname}${url.search}`;
}

export interface EpicFlowApiConfig {
  apiBaseUrl: string;
  getAuthToken?: () => string | Promise<string>;
}

export interface CreateEpicRequest extends EpicFlowFormInput {
  projectId: string;
  createdByUser?: string;
}

export interface CreateUserStoryRequest extends EpicFlowFormInput {
  createdByUser?: string;
}

export interface EpicFlowApiClient {
  getEpics(projectId: string): Promise<Epic[]>;
  createEpic(data: CreateEpicRequest): Promise<Epic>;
  updateEpic(epicId: string, data: EpicFlowFormInput): Promise<Epic>;
  deleteEpic(epicId: string): Promise<void>;
  getUserStoriesByEpic(epicId: string): Promise<UserStory[]>;
  createUserStory(epicId: string, data: CreateUserStoryRequest): Promise<UserStory>;
  updateUserStory(userStoryId: string, data: EpicFlowFormInput): Promise<UserStory>;
  deleteUserStory(userStoryId: string): Promise<void>;
}

/**
 * Talks to the EpicFlow endpoints (`/epics`, `/user-stories`) documented in
 * wec-pinnote-lib/docs/api-contract.md, on the same backend and base URL as
 * the annotations API. There is no Notes endpoint: the EpicFlow "Notes"
 * panel only ever displays the selected epic/user story's own title and
 * description, so no extra API surface is needed for it.
 */
export function createEpicFlowApi(config: EpicFlowApiConfig): EpicFlowApiClient {
  async function request<T>(options: RequestOptions): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const token = config.getAuthToken ? await config.getAuthToken() : undefined;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(joinUrl(config.apiBaseUrl, options.path, options.query), {
      method: options.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => null);
      throw new EpicFlowApiError(
        `EpicFlow API request failed (${response.status})`,
        response.status,
        body,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  }

  return {
    getEpics(projectId) {
      return request<Epic[]>({ method: "GET", path: "/epics", query: { projectId } });
    },

    createEpic(data) {
      return request<Epic>({ method: "POST", path: "/epics", body: data });
    },

    updateEpic(epicId, data) {
      return request<Epic>({
        method: "PATCH",
        path: `/epics/${encodeURIComponent(epicId)}`,
        body: data,
      });
    },

    deleteEpic(epicId) {
      return request<void>({ method: "DELETE", path: `/epics/${encodeURIComponent(epicId)}` });
    },

    getUserStoriesByEpic(epicId) {
      return request<UserStory[]>({ method: "GET", path: "/user-stories", query: { epicId } });
    },

    createUserStory(epicId, data) {
      return request<UserStory>({
        method: "POST",
        path: "/user-stories",
        body: { epicId, ...data },
      });
    },

    updateUserStory(userStoryId, data) {
      return request<UserStory>({
        method: "PATCH",
        path: `/user-stories/${encodeURIComponent(userStoryId)}`,
        body: data,
      });
    },

    deleteUserStory(userStoryId) {
      return request<void>({
        method: "DELETE",
        path: `/user-stories/${encodeURIComponent(userStoryId)}`,
      });
    },
  };
}

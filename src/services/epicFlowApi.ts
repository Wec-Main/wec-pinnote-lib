import type { Epic, EpicFlowFormInput, UserStory } from "../types/epicFlow.types";
import { AnnotationApiError } from "../types/annotation.types";
import { buildUrl, request, requestNoContent, type QueryValue } from "./httpClient";

export class EpicFlowApiError extends AnnotationApiError {
  constructor(message: string, status: number, body: string | null = null) {
    super(message, status, body);
    this.name = "EpicFlowApiError";
  }
}

function createEpicFlowError(message: string, status: number, body: string | null) {
  return new EpicFlowApiError(message, status, body);
}

interface RequestOptions {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
  signal?: AbortSignal;
}

export interface EpicFlowApiConfig {
  apiBaseUrl: string;
  getAuthToken?: () => string | Promise<string>;
}

export interface CreateEpicRequest extends EpicFlowFormInput {
  projectId: string;
}

export type CreateUserStoryRequest = EpicFlowFormInput;

export interface EpicFlowApiClient {
  getEpics(projectId: string, signal?: AbortSignal): Promise<Epic[]>;
  createEpic(data: CreateEpicRequest, signal?: AbortSignal): Promise<Epic>;
  updateEpic(epicId: string, data: EpicFlowFormInput, signal?: AbortSignal): Promise<Epic>;
  deleteEpic(epicId: string, signal?: AbortSignal): Promise<void>;
  getUserStoriesByEpic(epicId: string, signal?: AbortSignal): Promise<UserStory[]>;
  getUserStoriesByProject(projectId: string, signal?: AbortSignal): Promise<UserStory[]>;
  createUserStory(
    epicId: string,
    data: CreateUserStoryRequest,
    signal?: AbortSignal,
  ): Promise<UserStory>;
  updateUserStory(
    userStoryId: string,
    data: EpicFlowFormInput,
    signal?: AbortSignal,
  ): Promise<UserStory>;
  deleteUserStory(userStoryId: string, signal?: AbortSignal): Promise<void>;
}

export function createEpicFlowApi(config: EpicFlowApiConfig): EpicFlowApiClient {
  async function call<T>(options: RequestOptions): Promise<T> {
    const token = config.getAuthToken ? await config.getAuthToken() : undefined;
    const url = buildUrl(config.apiBaseUrl, options.path, options.query);
    return request<T>(
      url,
      token,
      {
        method: options.method,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
      },
      {
        fallbackMessage: (status) => `EpicFlow API request failed (${status})`,
        createError: createEpicFlowError,
      },
    );
  }

  async function callNoContent(options: RequestOptions): Promise<void> {
    const token = config.getAuthToken ? await config.getAuthToken() : undefined;
    const url = buildUrl(config.apiBaseUrl, options.path, options.query);
    await requestNoContent(
      url,
      token,
      {
        method: options.method,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
      },
      {
        fallbackMessage: (status) => `EpicFlow API request failed (${status})`,
        createError: createEpicFlowError,
      },
    );
  }

  return {
    getEpics(projectId, signal) {
      return call<Epic[]>({ method: "GET", path: "/epics", query: { projectId }, signal });
    },

    createEpic(data, signal) {
      return call<Epic>({ method: "POST", path: "/epics", body: data, signal });
    },

    updateEpic(epicId, data, signal) {
      return call<Epic>({
        method: "PATCH",
        path: `/epics/${encodeURIComponent(epicId)}`,
        body: data,
        signal,
      });
    },

    deleteEpic(epicId, signal) {
      return callNoContent({
        method: "DELETE",
        path: `/epics/${encodeURIComponent(epicId)}`,
        signal,
      });
    },

    getUserStoriesByEpic(epicId, signal) {
      return call<UserStory[]>({
        method: "GET",
        path: "/user-stories",
        query: { epicId },
        signal,
      });
    },

    getUserStoriesByProject(projectId, signal) {
      return call<UserStory[]>({
        method: "GET",
        path: "/user-stories",
        query: { projectId },
        signal,
      });
    },

    createUserStory(epicId, data, signal) {
      return call<UserStory>({
        method: "POST",
        path: "/user-stories",
        body: { epicId, ...data },
        signal,
      });
    },

    updateUserStory(userStoryId, data, signal) {
      return call<UserStory>({
        method: "PATCH",
        path: `/user-stories/${encodeURIComponent(userStoryId)}`,
        body: data,
        signal,
      });
    },

    deleteUserStory(userStoryId, signal) {
      return callNoContent({
        method: "DELETE",
        path: `/user-stories/${encodeURIComponent(userStoryId)}`,
        signal,
      });
    },
  };
}

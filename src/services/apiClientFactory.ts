import {
  buildUrl,
  request,
  requestNoContent,
  requestBlob,
  withUnauthorizedRetry,
  type ApiErrorFactory,
  type QueryValue,
  type RequestPolicy,
} from "./httpClient";
import { withRequestTimeout } from "../utils/requestTimeout";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type AuthTokenGetter = () => string | Promise<string>;

export type AuthTokenSource = string | undefined | AuthTokenGetter;

export interface ApiClientOptions {
  timeoutMs?: number;
  fallbackMessage?: (status: number) => string;
  createError?: ApiErrorFactory;
  reportUnauthorized?: boolean;
}

export interface ApiCallOptions {
  method?: HttpMethod;
  query?: Record<string, QueryValue>;
  body?: unknown;
  signal?: AbortSignal;
}

export interface ApiClient {
  call<T>(path: string, options?: ApiCallOptions): Promise<T>;
  callNoContent(path: string, options?: ApiCallOptions): Promise<void>;
  callBlob(path: string, options?: ApiCallOptions): Promise<Blob>;
}

export const DEFAULT_API_TIMEOUT_MS = 20_000;

const NEVER_ABORT_SIGNAL = new AbortController().signal;

function toAuthTokenGetter(source: AuthTokenSource): AuthTokenGetter | undefined {
  if (source === undefined) return undefined;
  return typeof source === "function" ? source : () => source;
}

export function createApiClient(
  apiBaseUrl: string,
  getAuthToken: AuthTokenSource,
  options: ApiClientOptions = {},
): ApiClient {
  const timeoutMs = options.timeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  const policy: RequestPolicy = {
    fallbackMessage: options.fallbackMessage,
    createError: options.createError,
    reportUnauthorized: options.reportUnauthorized,
  };
  const resolveToken = toAuthTokenGetter(getAuthToken);

  async function run<T>(
    executor: (url: string, token: string | undefined, init: RequestInit) => Promise<T>,
    path: string,
    callOptions: ApiCallOptions,
  ): Promise<T> {
    const url = buildUrl(apiBaseUrl, path, callOptions.query, policy);
    const outerSignal = callOptions.signal ?? NEVER_ABORT_SIGNAL;
    return withUnauthorizedRetry(resolveToken, (token) =>
      withRequestTimeout(outerSignal, timeoutMs, (signal) =>
        executor(url, token, {
          method: callOptions.method,
          body: callOptions.body === undefined ? undefined : JSON.stringify(callOptions.body),
          signal,
        }),
      ),
    );
  }

  return {
    call<T>(path: string, callOptions: ApiCallOptions = {}) {
      return run<T>((url, token, init) => request<T>(url, token, init, policy), path, callOptions);
    },
    callNoContent(path: string, callOptions: ApiCallOptions = {}) {
      return run<void>(
        (url, token, init) => requestNoContent(url, token, init, policy),
        path,
        callOptions,
      );
    },
    callBlob(path: string, callOptions: ApiCallOptions = {}) {
      return run<Blob>(
        (url, token, init) => requestBlob(url, token, init, policy),
        path,
        callOptions,
      );
    },
  };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { useAiRuntime } from "../AiRuntimeContext";
import {
  cancelConnectorLogin,
  fetchConnectorStatus,
  getConnectorLoginStatus,
  saveConnectorApiKey,
  startConnectorLogin,
  submitConnectorLoginCode,
} from "../../../services/aiService";
import type {
  AiConnector,
  AiLoginStart,
  AiLoginState,
  AiLoginStatus,
  AiProviderId,
} from "../../../types/ai.types";
import { AnnotationApiError } from "../../../types/annotation.types";
import { aiErrorCode, describeAiError, providerLabel } from "./aiHelpers";

export type ConnectorLoginPhase =
  "idle" | "starting" | "waiting" | "verifying" | "connected" | "failed";

export type ConnectorLoginErrorKind = "login_gone";

export interface ConnectorLoginState {
  phase: ConnectorLoginPhase;
  login: AiLoginStart | null;
  connector: AiConnector | null;
  error: string | null;
  errorKind?: ConnectorLoginErrorKind | null;
}

export interface ConnectorLogin extends ConnectorLoginState {
  start: () => Promise<AiLoginStart | null>;
  submitCode: (code: string) => Promise<void>;
  saveApiKey: (apiKey: string) => Promise<void>;
  cancel: () => void;
  probe: (signal?: AbortSignal) => Promise<AiConnector>;
}

type LiveLogin = AiLoginStart & { loginId: string };

const IDLE: ConnectorLoginState = { phase: "idle", login: null, connector: null, error: null };

const TERMINAL: readonly AiLoginState[] = ["succeeded", "failed", "cancelled", "expired"];

export const LOGIN_GONE_TEXT =
  "The sign-in link expired because the server restarted — get a new link.";

export function isLoginGone(err: unknown): boolean {
  return (
    (err instanceof AnnotationApiError && err.status === 404) ||
    aiErrorCode(err) === "login_not_found"
  );
}

function failureText(status: AiLoginStatus, label: string): string {
  if (status.error) return status.error;
  switch (status.state) {
    case "expired":
      return "The sign-in took too long and expired. Try again.";
    case "cancelled":
      return "The sign-in was cancelled. Try again.";
    default:
      return `${label} did not finish connecting. Try again.`;
  }
}

export function useConnectorLogin(provider: AiProviderId): ConnectorLogin {
  const { apiBaseUrl, getToken, projectId, mergeConnectors, subscribe } = useAiRuntime();
  const label = providerLabel(provider);
  const [state, setState] = useState<ConnectorLoginState>(IDLE);
  const liveRef = useRef<LiveLogin | null>(null);
  const epochRef = useRef(0);
  const mountedRef = useRef(true);

  const update = useCallback((epoch: number, next: ConnectorLoginState) => {
    if (mountedRef.current && epoch === epochRef.current) setState(next);
  }, []);

  const cancelOnServer = useCallback(
    (login: AiLoginStart | null) => {
      if (!login?.loginId) return;
      const loginId = login.loginId;
      void getToken()
        .then((authToken) =>
          cancelConnectorLogin(apiBaseUrl, authToken, projectId, login.provider, loginId),
        )
        .catch(() => undefined);
    },
    [apiBaseUrl, getToken, projectId],
  );

  const settle = useCallback(
    (epoch: number, login: LiveLogin, status: AiLoginStatus): boolean => {
      if (epoch !== epochRef.current) return true;
      if (status.state === "succeeded") {
        liveRef.current = null;
        if (status.connector) mergeConnectors([status.connector]);
        update(epoch, { phase: "connected", login, connector: status.connector, error: null });
        return true;
      }
      if (TERMINAL.includes(status.state)) {
        liveRef.current = null;
        update(epoch, {
          phase: "failed",
          login,
          connector: null,
          error: failureText(status, label),
        });
        return true;
      }
      return false;
    },
    [label, mergeConnectors, update],
  );

  const cancel = useCallback(() => {
    epochRef.current += 1;
    cancelOnServer(liveRef.current);
    liveRef.current = null;
    if (mountedRef.current) setState(IDLE);
  }, [cancelOnServer]);

  const start = useCallback(async (): Promise<AiLoginStart | null> => {
    epochRef.current += 1;
    const epoch = epochRef.current;
    cancelOnServer(liveRef.current);
    liveRef.current = null;
    update(epoch, { phase: "starting", login: null, connector: null, error: null });
    try {
      const authToken = await getToken();
      const login = await startConnectorLogin(apiBaseUrl, authToken, projectId, provider);
      if (epoch !== epochRef.current || !mountedRef.current) {
        cancelOnServer(login);
        return null;
      }
      if (login.alreadyConnected && login.connector) {
        mergeConnectors([login.connector]);
        update(epoch, { phase: "connected", login, connector: login.connector, error: null });
        return login;
      }
      if (!login.loginId) throw new Error(`${label} did not return a sign-in link`);
      const live: LiveLogin = { ...login, loginId: login.loginId };
      liveRef.current = live;
      update(epoch, { phase: "waiting", login: live, connector: null, error: null });
      return live;
    } catch (err) {
      update(epoch, {
        phase: "failed",
        login: null,
        connector: null,
        error: describeAiError(err, `Could not start signing in to ${label}`),
      });
      return null;
    }
  }, [apiBaseUrl, cancelOnServer, getToken, label, mergeConnectors, projectId, provider, update]);

  const submitCode = useCallback(
    async (code: string) => {
      const login = liveRef.current;
      const trimmed = code.trim();
      if (!login || !trimmed) return;
      const epoch = epochRef.current;
      update(epoch, { phase: "verifying", login, connector: null, error: null });
      try {
        const authToken = await getToken();
        const status = await submitConnectorLoginCode(
          apiBaseUrl,
          authToken,
          projectId,
          provider,
          login.loginId,
          trimmed,
        );
        settle(epoch, login, status);
      } catch (err) {
        if (isLoginGone(err)) {
          if (liveRef.current?.loginId === login.loginId) liveRef.current = null;
          update(epoch, {
            phase: "failed",
            login: null,
            connector: null,
            error: LOGIN_GONE_TEXT,
            errorKind: "login_gone",
          });
          return;
        }
        update(epoch, {
          phase: "waiting",
          login,
          connector: null,
          error: describeAiError(err, `${label} did not accept that code. Check it and try again.`),
        });
      }
    },
    [apiBaseUrl, getToken, label, projectId, provider, settle, update],
  );

  const saveApiKey = useCallback(
    async (apiKey: string) => {
      const trimmed = apiKey.trim();
      if (!trimmed) return;
      epochRef.current += 1;
      const epoch = epochRef.current;
      cancelOnServer(liveRef.current);
      liveRef.current = null;
      update(epoch, { phase: "verifying", login: null, connector: null, error: null });
      try {
        const authToken = await getToken();
        const connector = await saveConnectorApiKey(
          apiBaseUrl,
          authToken,
          projectId,
          provider,
          trimmed,
        );
        mergeConnectors([connector]);
        if (connector.status === "connected") {
          update(epoch, { phase: "connected", login: null, connector, error: null });
        } else {
          update(epoch, {
            phase: "failed",
            login: null,
            connector: null,
            error: connector.error ?? `${label} did not accept that API key.`,
          });
        }
      } catch (err) {
        update(epoch, {
          phase: "failed",
          login: null,
          connector: null,
          error: describeAiError(err, `Could not save the ${label} API key`),
        });
      }
    },
    [apiBaseUrl, cancelOnServer, getToken, label, mergeConnectors, projectId, provider, update],
  );

  const checkOnce = useCallback(async () => {
    const login = liveRef.current;
    if (!login) return;
    const epoch = epochRef.current;
    try {
      const authToken = await getToken();
      const status = await getConnectorLoginStatus(
        apiBaseUrl,
        authToken,
        projectId,
        login.provider,
        login.loginId,
      );
      if (liveRef.current?.loginId === login.loginId) settle(epoch, login, status);
    } catch (err) {
      if (isLoginGone(err) && liveRef.current?.loginId === login.loginId) {
        liveRef.current = null;
        update(epoch, {
          phase: "failed",
          login: null,
          connector: null,
          error: LOGIN_GONE_TEXT,
          errorKind: "login_gone",
        });
      }
    }
  }, [apiBaseUrl, getToken, projectId, settle, update]);

  useEffect(
    () =>
      subscribe(
        (event) => {
          if (event.type !== "ai_connector_login.updated") return;
          const login = liveRef.current;
          if (!login || login.loginId !== event.loginId) return;
          const epoch = epochRef.current;
          if (settle(epoch, login, event)) return;
          if (event.state === "verifying") {
            update(epoch, { phase: "verifying", login, connector: null, error: null });
          }
        },
        () => void checkOnce(),
      ),
    [checkOnce, settle, subscribe, update],
  );

  const liveLoginId =
    state.phase === "waiting" || state.phase === "verifying"
      ? (state.login?.loginId ?? null)
      : null;
  useEffect(() => {
    const login = liveRef.current;
    if (!liveLoginId || !login || login.loginId !== liveLoginId) return undefined;
    const expiresAt = Date.parse(login.expiresAt);
    if (!Number.isFinite(expiresAt)) return undefined;
    const epoch = epochRef.current;
    const timer = setTimeout(
      () => {
        if (liveRef.current?.loginId !== login.loginId) return;
        cancelOnServer(login);
        settle(epoch, login, {
          loginId: login.loginId,
          provider: login.provider,
          state: "expired",
          error: null,
          connector: null,
        });
      },
      Math.max(0, expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [cancelOnServer, liveLoginId, settle]);

  const probe = useCallback(
    async (signal?: AbortSignal): Promise<AiConnector> => {
      const authToken = await getToken();
      const live = await fetchConnectorStatus(
        apiBaseUrl,
        authToken,
        projectId,
        provider,
        true,
        signal,
      );
      if (mountedRef.current) mergeConnectors([live]);
      return live;
    },
    [apiBaseUrl, getToken, mergeConnectors, projectId, provider],
  );

  const cancelOnServerRef = useRef(cancelOnServer);
  cancelOnServerRef.current = cancelOnServer;
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      epochRef.current += 1;
      cancelOnServerRef.current(liveRef.current);
      liveRef.current = null;
    };
  }, []);

  return { ...state, start, submitCode, saveApiKey, cancel, probe };
}

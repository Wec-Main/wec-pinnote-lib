import { useCallback, useEffect, useMemo, useState } from "react";
import { createAuthApi } from "../services/authApi";
import type { AuthApiClient, AuthSession, LoginOption } from "../types/auth.types";

interface StoredAuth {
  accounts: AuthSession[];
  activeId: string | null;
}

const EMPTY: StoredAuth = { accounts: [], activeId: null };

function storageKey(projectId: string): string {
  return `wpn-auth:${projectId}`;
}

function readStored(projectId: string): StoredAuth {
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) {
      return EMPTY;
    }
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!Array.isArray(parsed.accounts)) {
      return EMPTY;
    }
    return { accounts: parsed.accounts, activeId: parsed.activeId ?? null };
  } catch {
    return EMPTY;
  }
}

function writeStored(projectId: string, value: StoredAuth): void {
  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(value));
  } catch {
    // Ignore storage failures (private browsing, disabled storage, etc.).
  }
}

export interface AuthSessionsValue {
  accounts: AuthSession[];
  activeAccount: AuthSession | null;
  loginOptions: LoginOption[];
  loginOptionsLoading: boolean;
  loginOptionsError: string | null;
  reloadLoginOptions: () => void;
  login: (userId: string, password: string) => Promise<void>;
  logout: (userId: string) => void;
  switchAccount: (userId: string) => void;
}

export function useAuthSessions(
  apiBaseUrl: string,
  projectId: string,
  client?: AuthApiClient,
): AuthSessionsValue {
  const authApi = useMemo(() => client ?? createAuthApi(apiBaseUrl), [client, apiBaseUrl]);
  const [stored, setStored] = useState<StoredAuth>(() => readStored(projectId));
  const [loginOptions, setLoginOptions] = useState<LoginOption[]>([]);
  const [loginOptionsLoading, setLoginOptionsLoading] = useState(false);
  const [loginOptionsError, setLoginOptionsError] = useState<string | null>(null);
  const [optionsNonce, setOptionsNonce] = useState(0);

  useEffect(() => {
    setStored(readStored(projectId));
  }, [projectId]);

  const persist = useCallback(
    (next: StoredAuth) => {
      setStored(next);
      writeStored(projectId, next);
    },
    [projectId],
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoginOptionsLoading(true);
    setLoginOptionsError(null);
    authApi
      .listLoginOptions(projectId, controller.signal)
      .then((options) => {
        setLoginOptions(options);
        setLoginOptionsLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setLoginOptions([]);
        setLoginOptionsError(err instanceof Error ? err.message : "Unable to load users.");
        setLoginOptionsLoading(false);
      });
    return () => controller.abort();
  }, [authApi, projectId, optionsNonce]);

  const reloadLoginOptions = useCallback(() => setOptionsNonce((value) => value + 1), []);

  const login = useCallback(
    async (userId: string, password: string) => {
      const session = await authApi.login(projectId, userId, password);
      const accounts = [...stored.accounts.filter((item) => item.id !== session.id), session];
      persist({ accounts, activeId: session.id });
    },
    [authApi, projectId, persist, stored.accounts],
  );

  const logout = useCallback(
    (userId: string) => {
      void authApi.logout(projectId, userId);
      const accounts = stored.accounts.filter((item) => item.id !== userId);
      const activeId = stored.activeId === userId ? (accounts[0]?.id ?? null) : stored.activeId;
      persist({ accounts, activeId });
    },
    [authApi, projectId, persist, stored.accounts, stored.activeId],
  );

  const switchAccount = useCallback(
    (userId: string) => {
      if (!stored.accounts.some((item) => item.id === userId)) {
        return;
      }
      persist({ ...stored, activeId: userId });
    },
    [persist, stored],
  );

  const activeAccount = useMemo(
    () => stored.accounts.find((item) => item.id === stored.activeId) ?? null,
    [stored.accounts, stored.activeId],
  );

  return {
    accounts: stored.accounts,
    activeAccount,
    loginOptions,
    loginOptionsLoading,
    loginOptionsError,
    reloadLoginOptions,
    login,
    logout,
    switchAccount,
  };
}

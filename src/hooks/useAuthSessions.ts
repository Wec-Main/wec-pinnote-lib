import { useCallback, useEffect, useMemo, useState } from "react";
import { createAuthApi } from "../services/authApi";
import { useSharedFetch } from "./useSharedFetch";
import type { AuthApiClient, AuthSession, LoginOption } from "../types/auth.types";

export interface StoredAuth {
  accounts: AuthSession[];
  activeId: string | null;
}

const EMPTY: StoredAuth = { accounts: [], activeId: null };

function storageKey(projectId: string): string {
  return `wpn-auth:${projectId}`;
}

export function isSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<AuthSession>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.name === "string" &&
    typeof candidate.roleId === "string" &&
    typeof candidate.token === "string" &&
    candidate.token.length > 0
  );
}

/**
 * Storage is user-writable and survives across releases, so an entry that no
 * longer matches the session shape is discarded rather than trusted. An activeId
 * pointing at no account would leave the UI signed in with nobody.
 */
export function normalizeStoredAuth(parsed: Partial<StoredAuth> | null): StoredAuth {
  if (!parsed || !Array.isArray(parsed.accounts)) {
    return EMPTY;
  }
  const accounts = parsed.accounts.filter(isSession);
  const activeId =
    typeof parsed.activeId === "string" &&
    accounts.some((account) => account.id === parsed.activeId)
      ? parsed.activeId
      : (accounts[0]?.id ?? null);
  return { accounts, activeId };
}

function readStored(projectId: string): StoredAuth {
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) {
      return EMPTY;
    }
    return normalizeStoredAuth(JSON.parse(raw) as Partial<StoredAuth>);
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

  useEffect(() => {
    setStored(readStored(projectId));
  }, [projectId]);

  /**
   * Sessions live in storage shared by every tab on the origin, so signing out
   * in one tab must not leave the others holding an account the user believes
   * they closed.
   */
  useEffect(() => {
    const watched = storageKey(projectId);
    const onStorage = (event: StorageEvent) => {
      const changed = event.key;
      if (changed !== null && changed !== watched) {
        return;
      }
      setStored(readStored(projectId));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [projectId]);

  /**
   * Storage is shared by every tab, so a write here can race a write another
   * tab made moments ago. Computing `next` from React's in-memory `current`
   * would silently clobber that other tab's change; reading storage fresh
   * right before writing keeps a concurrent update from being lost.
   */
  const persist = useCallback(
    (update: (current: StoredAuth) => StoredAuth) => {
      const next = update(readStored(projectId));
      writeStored(projectId, next);
      setStored(next);
    },
    [projectId],
  );

  const loginOptionsKey = `auth-users:${apiBaseUrl}:${projectId}`;
  const {
    data: loginOptionsData,
    loading: loginOptionsLoading,
    error: loginOptionsErrorValue,
    reload: reloadLoginOptions,
  } = useSharedFetch<LoginOption[]>(loginOptionsKey, (signal) =>
    authApi.listLoginOptions(projectId, signal),
  );
  const loginOptions = useMemo(() => loginOptionsData ?? [], [loginOptionsData]);
  const loginOptionsError = loginOptionsErrorValue
    ? loginOptionsErrorValue instanceof Error
      ? loginOptionsErrorValue.message
      : "Unable to load users."
    : null;

  /**
   * A stored session outlives the account it names: a user deleted or
   * deactivated server-side would otherwise stay signed in here while every
   * request they make fails. The login list is the authoritative roster, so any
   * session missing from it is dropped once the list has actually loaded.
   */
  useEffect(() => {
    if (loginOptionsLoading || loginOptionsError || loginOptions.length === 0) {
      return;
    }
    const known = new Set(loginOptions.map((option) => option.id));
    persist((current) => {
      const accounts = current.accounts.filter((account) => known.has(account.id));
      if (accounts.length === current.accounts.length) {
        return current;
      }
      return {
        accounts,
        activeId: accounts.some((account) => account.id === current.activeId)
          ? current.activeId
          : (accounts[0]?.id ?? null),
      };
    });
  }, [loginOptions, loginOptionsError, loginOptionsLoading, persist]);

  const login = useCallback(
    async (userId: string, password: string) => {
      const session = await authApi.login(projectId, userId, password);
      persist((current) => ({
        accounts: [...current.accounts.filter((item) => item.id !== session.id), session],
        activeId: session.id,
      }));
    },
    [authApi, projectId, persist],
  );

  const logout = useCallback(
    (userId: string) => {
      void authApi.logout(projectId, userId);
      persist((current) => {
        const accounts = current.accounts.filter((item) => item.id !== userId);
        return {
          accounts,
          activeId: current.activeId === userId ? (accounts[0]?.id ?? null) : current.activeId,
        };
      });
    },
    [authApi, projectId, persist],
  );

  const switchAccount = useCallback(
    (userId: string) => {
      persist((current) =>
        current.accounts.some((item) => item.id === userId)
          ? { ...current, activeId: userId }
          : current,
      );
    },
    [persist],
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

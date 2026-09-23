import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createAuthApi } from "../services/authApi";
import { UNAUTHORIZED_EVENT, type UnauthorizedDetail } from "../services/httpClient";
import { useSharedFetch } from "./useSharedFetch";
import { AnnotationApiError } from "../types/annotation.types";
import type { AuthApiClient, AuthSession, LoginOption } from "../types/auth.types";
import { isSession, tokenExpiry } from "../utils/authSession";

export interface StoredAuth {
  accounts: AuthSession[];
  activeId: string | null;
}

interface RenewalTimer {
  token: string;
  timer: ReturnType<typeof setTimeout>;
}

const EMPTY: StoredAuth = { accounts: [], activeId: null };
const RENEWAL_FRACTION = 0.8;
const MIN_RENEWAL_DELAY_MS = 30 * 1000;
const RETRY_BASE_DELAY_MS = 5 * 1000;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;
const MAX_TIMEOUT_MS = 2_147_483_647;

function storageKey(projectId: string): string {
  return `wpn-auth:${projectId}`;
}

function renewalDelay(exp: number): number {
  const remaining = exp * 1000 - Date.now();
  return Math.max(MIN_RENEWAL_DELAY_MS, remaining * RENEWAL_FRACTION);
}

function retryDelay(attempt: number): number {
  return Math.min(MAX_RETRY_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof AnnotationApiError && error.status === 401;
}

function resolveActiveId(accounts: AuthSession[], activeId: string | null): string | null {
  return accounts.some((account) => account.id === activeId) ? activeId : (accounts[0]?.id ?? null);
}

export function normalizeStoredAuth(parsed: Partial<StoredAuth> | null): StoredAuth {
  if (!parsed || !Array.isArray(parsed.accounts)) {
    return EMPTY;
  }
  const accounts = parsed.accounts.filter(isSession);
  const activeId = resolveActiveId(
    accounts,
    typeof parsed.activeId === "string" ? parsed.activeId : null,
  );
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
    return;
  }
}

function revokeErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : "Unable to sign out on the server.";
}

export interface AuthSessionsValue {
  accounts: AuthSession[];
  activeAccount: AuthSession | null;
  loginOptions: LoginOption[];
  loginOptionsLoading: boolean;
  loginOptionsError: string | null;
  reloadLoginOptions: () => void;
  login: (userId: string, password: string) => Promise<void>;
  logout: (userId: string) => Promise<void>;
  switchAccount: (userId: string) => void;
  revokeError: string | null;
  clearRevokeError: () => void;
}

export function useAuthSessions(
  apiBaseUrl: string,
  projectId: string,
  client?: AuthApiClient,
): AuthSessionsValue {
  const authApi = useMemo(() => client ?? createAuthApi(apiBaseUrl), [client, apiBaseUrl]);
  const [stored, setStored] = useState<StoredAuth>(EMPTY);
  const storedRef = useRef<StoredAuth>(EMPTY);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const load = useCallback((next: StoredAuth) => {
    storedRef.current = next;
    setStored(next);
  }, []);

  useEffect(() => {
    load(readStored(projectId));
  }, [projectId, load]);

  useEffect(() => {
    const watched = storageKey(projectId);
    const onStorage = (event: StorageEvent) => {
      const changed = event.key;
      if (changed !== null && changed !== watched) {
        return;
      }
      load(readStored(projectId));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [projectId, load]);

  const persist = useCallback(
    (update: (current: StoredAuth) => StoredAuth) => {
      const current = storedRef.current;
      const next = update(current);
      if (next === current) {
        return;
      }
      load(next);
      writeStored(projectId, next);
    },
    [projectId, load],
  );

  const removeAccount = useCallback(
    (userId: string) => {
      persist((current) => {
        const accounts = current.accounts.filter((item) => item.id !== userId);
        return {
          accounts,
          activeId: current.activeId === userId ? (accounts[0]?.id ?? null) : current.activeId,
        };
      });
    },
    [persist],
  );

  const renewingRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<Map<string, RenewalTimer>>(new Map());
  const failuresRef = useRef<Map<string, number>>(new Map());
  const issuedRef = useRef<Map<string, string>>(new Map());
  const renewRef = useRef<(accountId: string) => Promise<void>>(() => Promise.resolve());

  const armRenewal = useCallback((accountId: string, token: string, delay: number) => {
    const timers = timersRef.current;
    const existing = timers.get(accountId);
    if (existing) {
      clearTimeout(existing.timer);
    }
    const timer = setTimeout(
      () => {
        timers.delete(accountId);
        void renewRef.current(accountId);
      },
      Math.min(delay, MAX_TIMEOUT_MS),
    );
    timers.set(accountId, { token, timer });
  }, []);

  const renewAccount = useCallback(
    async (accountId: string) => {
      const account = storedRef.current.accounts.find((item) => item.id === accountId);
      if (!account || renewingRef.current.has(accountId)) {
        return;
      }
      renewingRef.current.add(accountId);
      try {
        const token = await authApi.refresh(projectId, account.refreshToken);
        failuresRef.current.delete(accountId);
        issuedRef.current.set(accountId, token);
        persist((current) => ({
          ...current,
          accounts: current.accounts.map((item) =>
            item.id === accountId ? { ...item, token } : item,
          ),
        }));
      } catch (err) {
        if (isUnauthorized(err)) {
          removeAccount(accountId);
          return;
        }
        const attempt = (failuresRef.current.get(accountId) ?? 0) + 1;
        failuresRef.current.set(accountId, attempt);
        armRenewal(accountId, account.token, retryDelay(attempt));
      } finally {
        renewingRef.current.delete(accountId);
      }
    },
    [authApi, projectId, persist, removeAccount, armRenewal],
  );

  useEffect(() => {
    renewRef.current = renewAccount;
  }, [renewAccount]);

  useEffect(() => {
    const onUnauthorized = (event: Event) => {
      const { token } = (event as CustomEvent<UnauthorizedDetail>).detail;
      const account = storedRef.current.accounts.find((item) => item.token === token);
      if (!account || issuedRef.current.get(account.id) === token) {
        return;
      }
      void renewAccount(account.id);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [renewAccount]);

  useEffect(() => {
    const timers = timersRef.current;
    const failures = failuresRef.current;
    const issued = issuedRef.current;
    return () => {
      for (const entry of timers.values()) {
        clearTimeout(entry.timer);
      }
      timers.clear();
      failures.clear();
      issued.clear();
    };
  }, [projectId]);

  useEffect(() => {
    const timers = timersRef.current;
    const liveIds = new Set(stored.accounts.map((account) => account.id));
    for (const [id, entry] of timers) {
      if (!liveIds.has(id)) {
        clearTimeout(entry.timer);
        timers.delete(id);
        failuresRef.current.delete(id);
        issuedRef.current.delete(id);
      }
    }

    for (const account of stored.accounts) {
      if (timers.get(account.id)?.token === account.token) {
        continue;
      }
      const exp = tokenExpiry(account.token);
      if (exp === undefined) {
        continue;
      }
      armRenewal(account.id, account.token, renewalDelay(exp));
    }
  }, [stored.accounts, armRenewal]);

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
      return { accounts, activeId: resolveActiveId(accounts, current.activeId) };
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

  const revokeServerSession = useCallback(
    async (account: AuthSession) => {
      try {
        await authApi.logout(projectId, account.id, undefined, account.token);
        return;
      } catch (err) {
        if (!isUnauthorized(err)) {
          throw err;
        }
      }
      try {
        const token = await authApi.refresh(projectId, account.refreshToken);
        await authApi.logout(projectId, account.id, undefined, token);
      } catch (err) {
        if (!isUnauthorized(err)) {
          throw err;
        }
      }
    },
    [authApi, projectId],
  );

  const logout = useCallback(
    async (userId: string) => {
      const account = storedRef.current.accounts.find((item) => item.id === userId);
      setRevokeError(null);
      try {
        if (account) {
          await revokeServerSession(account);
        }
      } catch (err) {
        setRevokeError(revokeErrorMessage(err));
        throw err;
      } finally {
        removeAccount(userId);
      }
    },
    [removeAccount, revokeServerSession],
  );

  const clearRevokeError = useCallback(() => setRevokeError(null), []);

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

  return useMemo(
    () => ({
      accounts: stored.accounts,
      activeAccount,
      loginOptions,
      loginOptionsLoading,
      loginOptionsError,
      reloadLoginOptions,
      login,
      logout,
      switchAccount,
      revokeError,
      clearRevokeError,
    }),
    [
      stored.accounts,
      activeAccount,
      loginOptions,
      loginOptionsLoading,
      loginOptionsError,
      reloadLoginOptions,
      login,
      logout,
      switchAccount,
      revokeError,
      clearRevokeError,
    ],
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createAuthApi } from "../services/authApi";
import { UNAUTHORIZED_EVENT, type UnauthorizedDetail } from "../services/httpClient";
import { useSharedFetch } from "./useSharedFetch";
import { AnnotationApiError } from "../types/annotation.types";
import type { AuthApiClient, AuthSession, LoginOption } from "../types/auth.types";

export interface StoredAuth {
  accounts: AuthSession[];
  activeId: string | null;
}

const EMPTY: StoredAuth = { accounts: [], activeId: null };
const RENEWAL_LEAD_MS = 5 * 60 * 1000;

function storageKey(projectId: string): string {
  return `wpn-auth:${projectId}`;
}

export function tokenExpiry(token: string): number | undefined {
  const segments = token.split(".");
  if (segments.length !== 3) {
    return undefined;
  }
  const payloadSegment = segments[1];
  if (!payloadSegment) {
    return undefined;
  }
  try {
    const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const json = atob(padded);
    const payload = JSON.parse(json) as Record<string, unknown>;
    return typeof payload.exp === "number" ? payload.exp : undefined;
  } catch {
    return undefined;
  }
}

export function isTokenUnexpired(token: string): boolean {
  const exp = tokenExpiry(token);
  return exp !== undefined && exp > Date.now() / 1000;
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
    candidate.token.length > 0 &&
    typeof candidate.refreshToken === "string" &&
    candidate.refreshToken.length > 0 &&
    isTokenUnexpired(candidate.token)
  );
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

  const persist = useCallback(
    (update: (current: StoredAuth) => StoredAuth) => {
      const next = update(readStored(projectId));
      writeStored(projectId, next);
      setStored(next);
    },
    [projectId],
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

  const renewAccount = useCallback(
    async (accountId: string, refreshToken: string) => {
      if (renewingRef.current.has(accountId)) {
        return;
      }
      renewingRef.current.add(accountId);
      try {
        const token = await authApi.refresh(projectId, refreshToken);
        persist((current) => ({
          ...current,
          accounts: current.accounts.map((item) =>
            item.id === accountId ? { ...item, token } : item,
          ),
        }));
      } catch (err) {
        if (isUnauthorized(err)) {
          removeAccount(accountId);
        }
      } finally {
        renewingRef.current.delete(accountId);
      }
    },
    [authApi, projectId, persist, removeAccount],
  );

  useEffect(() => {
    const onUnauthorized = (event: Event) => {
      const { token } = (event as CustomEvent<UnauthorizedDetail>).detail;
      const account = readStored(projectId).accounts.find((item) => item.token === token);
      if (account) {
        void renewAccount(account.id, account.refreshToken);
      }
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [projectId, renewAccount]);

  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, [projectId]);

  useEffect(() => {
    const timers = timersRef.current;
    const liveIds = new Set(stored.accounts.map((account) => account.id));
    for (const [id, timer] of timers) {
      if (!liveIds.has(id)) {
        clearTimeout(timer);
        timers.delete(id);
      }
    }

    for (const account of stored.accounts) {
      if (timers.has(account.id)) {
        continue;
      }
      const exp = tokenExpiry(account.token);
      if (exp === undefined) {
        continue;
      }
      const fireAt = exp * 1000 - RENEWAL_LEAD_MS;
      const delay = Math.max(0, fireAt - Date.now());
      const accountId = account.id;
      const refreshToken = account.refreshToken;
      const timer = setTimeout(() => {
        timersRef.current.delete(accountId);
        void renewAccount(accountId, refreshToken);
      }, delay);
      timers.set(account.id, timer);
    }
  }, [stored.accounts, renewAccount]);

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
      const account = readStored(projectId).accounts.find((item) => item.id === userId);
      try {
        if (account) {
          await revokeServerSession(account);
        }
      } finally {
        removeAccount(userId);
      }
    },
    [projectId, removeAccount, revokeServerSession],
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

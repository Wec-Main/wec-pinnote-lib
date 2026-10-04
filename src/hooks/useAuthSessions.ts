import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createAuthApi } from "../services/authService";
import { UNAUTHORIZED_EVENT, type UnauthorizedDetail } from "../services/httpClient";
import { useSharedFetch } from "./useSharedFetch";
import { AnnotationApiError } from "../types/annotation.types";
import type { AuthApiClient, AuthSession, LoginOption } from "../types/auth.types";
import { isSession, isTokenUnexpired, tokenExpiry, tokenIssuedAt } from "../utils/auth/authSession";
import { tokenStorage } from "./tokenStorage";

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
const EXPIRY_MARGIN_MS = 30 * 1000;
const RETRY_BASE_DELAY_MS = 5 * 1000;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;
const MAX_TIMEOUT_MS = 2_147_483_647;
const ACTIVITY_WINDOW_MS = 30 * 60 * 1000;
const ACTIVITY_CHECK_INTERVAL_MS = 1000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "focus"] as const;

function storageKey(projectId: string): string {
  return `wpn-auth:${projectId}`;
}

function renewalDueAt(token: string): number | undefined {
  const exp = tokenExpiry(token);
  if (exp === undefined) {
    return undefined;
  }
  const iat = tokenIssuedAt(token);
  const lifetime = iat !== undefined && iat < exp ? exp - iat : 0;
  return (exp - lifetime * (1 - RENEWAL_FRACTION)) * 1000;
}

function renewalDelay(token: string): number | undefined {
  const dueAt = renewalDueAt(token);
  return dueAt === undefined ? undefined : Math.max(MIN_RENEWAL_DELAY_MS, dueAt - Date.now());
}

function isRenewalDue(token: string): boolean {
  const dueAt = renewalDueAt(token);
  return dueAt !== undefined && dueAt <= Date.now();
}

function isExpiringSoon(token: string): boolean {
  const exp = tokenExpiry(token);
  return exp === undefined || exp * 1000 - Date.now() <= EXPIRY_MARGIN_MS;
}

function refreshExpiryDelay(refreshToken: string): number {
  const exp = tokenExpiry(refreshToken);
  return exp === undefined ? 0 : Math.max(0, exp * 1000 - Date.now());
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
  const raw = tokenStorage.read(storageKey(projectId));
  return raw ? normalizeStoredAuth(raw) : EMPTY;
}

function writeStored(projectId: string, value: StoredAuth): void {
  tokenStorage.write(storageKey(projectId), value);
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
  getAccessToken: (userId: string) => Promise<string | undefined>;
  revokeError: string | null;
  clearRevokeError: () => void;
}

export function useAuthSessions(
  apiBaseUrl: string,
  projectId: string,
  client?: AuthApiClient,
  loginPickerEnabled = true,
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

  const removeAccountSession = useCallback(
    (userId: string, refreshToken: string) => {
      persist((current) => {
        const target = current.accounts.find((item) => item.id === userId);
        if (!target || target.refreshToken !== refreshToken) {
          return current;
        }
        const accounts = current.accounts.filter((item) => item.id !== userId);
        return {
          accounts,
          activeId: current.activeId === userId ? (accounts[0]?.id ?? null) : current.activeId,
        };
      });
    },
    [persist],
  );

  const inflightRef = useRef<Map<string, Promise<string | undefined>>>(new Map());
  const timersRef = useRef<Map<string, RenewalTimer>>(new Map());
  const failuresRef = useRef<Map<string, number>>(new Map());
  const renewedAtRef = useRef<Map<string, number>>(new Map());
  const lastActivityRef = useRef(Date.now());
  const renewalDueRef = useRef<(accountId: string) => void>(() => undefined);

  const armRenewal = useCallback((accountId: string, token: string, delay: number) => {
    const timers = timersRef.current;
    const existing = timers.get(accountId);
    if (existing) {
      clearTimeout(existing.timer);
    }
    const timer = setTimeout(
      () => {
        timers.delete(accountId);
        renewalDueRef.current(accountId);
      },
      Math.min(delay, MAX_TIMEOUT_MS),
    );
    timers.set(accountId, { token, timer });
  }, []);

  const recentlyRenewed = useCallback((accountId: string) => {
    const renewedAt = renewedAtRef.current.get(accountId);
    return renewedAt !== undefined && Date.now() - renewedAt < MIN_RENEWAL_DELAY_MS;
  }, []);

  const currentAccount = useCallback(
    (accountId: string) => storedRef.current.accounts.find((item) => item.id === accountId),
    [],
  );

  const runRenewal = useCallback(
    async (account: AuthSession): Promise<string | undefined> => {
      const usedRefreshToken = account.refreshToken;
      try {
        const renewed = await authApi.refresh(projectId, usedRefreshToken);
        failuresRef.current.delete(account.id);
        renewedAtRef.current.set(account.id, Date.now());
        const latest = currentAccount(account.id);
        if (!latest || latest.refreshToken !== usedRefreshToken) {
          return latest?.token;
        }
        persist((current) => ({
          ...current,
          accounts: current.accounts.map((item) =>
            item.id === account.id
              ? {
                  ...item,
                  token: renewed.token,
                  refreshToken: renewed.refreshToken ?? item.refreshToken,
                }
              : item,
          ),
        }));
        return renewed.token;
      } catch (err) {
        if (isUnauthorized(err)) {
          removeAccountSession(account.id, usedRefreshToken);
          return currentAccount(account.id)?.token;
        }
        const attempt = (failuresRef.current.get(account.id) ?? 0) + 1;
        failuresRef.current.set(account.id, attempt);
        armRenewal(account.id, account.token, retryDelay(attempt));
        return currentAccount(account.id)?.token;
      }
    },
    [authApi, projectId, persist, removeAccountSession, armRenewal, currentAccount],
  );

  const renewAccount = useCallback(
    (accountId: string): Promise<string | undefined> => {
      const inflight = inflightRef.current;
      const pending = inflight.get(accountId);
      if (pending) {
        return pending;
      }
      const account = currentAccount(accountId);
      if (!account) {
        return Promise.resolve(undefined);
      }
      const run = runRenewal(account).finally(() => {
        if (inflight.get(accountId) === run) {
          inflight.delete(accountId);
        }
      });
      inflight.set(accountId, run);
      return run;
    },
    [currentAccount, runRenewal],
  );

  const getAccessToken = useCallback(
    async (accountId: string): Promise<string | undefined> => {
      const account = currentAccount(accountId);
      if (!account) {
        return undefined;
      }
      if (!isExpiringSoon(account.token) || recentlyRenewed(accountId)) {
        return account.token;
      }
      return renewAccount(accountId);
    },
    [currentAccount, renewAccount, recentlyRenewed],
  );

  useEffect(() => {
    renewalDueRef.current = (accountId: string) => {
      const account = currentAccount(accountId);
      if (!account) {
        return;
      }
      if (!isTokenUnexpired(account.refreshToken)) {
        removeAccountSession(account.id, account.refreshToken);
        return;
      }
      if (Date.now() - lastActivityRef.current < ACTIVITY_WINDOW_MS) {
        void renewAccount(accountId);
        return;
      }
      armRenewal(accountId, account.token, refreshExpiryDelay(account.refreshToken));
    };
  }, [currentAccount, removeAccountSession, renewAccount, armRenewal]);

  useEffect(() => {
    let lastCheck = 0;
    const onActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      if (now - lastCheck < ACTIVITY_CHECK_INTERVAL_MS) {
        return;
      }
      lastCheck = now;
      for (const account of storedRef.current.accounts) {
        if (isRenewalDue(account.token) && !recentlyRenewed(account.id)) {
          void renewAccount(account.id);
        }
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        onActivity();
      }
    };
    for (const type of ACTIVITY_EVENTS) {
      window.addEventListener(type, onActivity, { capture: true, passive: true });
    }
    window.addEventListener("online", onActivity);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      for (const type of ACTIVITY_EVENTS) {
        window.removeEventListener(type, onActivity, { capture: true });
      }
      window.removeEventListener("online", onActivity);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [renewAccount, recentlyRenewed]);

  useEffect(() => {
    const onUnauthorized = (event: Event) => {
      const { token } = (event as CustomEvent<UnauthorizedDetail>).detail;
      const account = storedRef.current.accounts.find((item) => item.token === token);
      if (!account) {
        return;
      }
      if (recentlyRenewed(account.id)) {
        return;
      }
      void renewAccount(account.id);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [renewAccount, recentlyRenewed]);

  useEffect(() => {
    const timers = timersRef.current;
    const failures = failuresRef.current;
    const renewedAt = renewedAtRef.current;
    const inflight = inflightRef.current;
    return () => {
      for (const entry of timers.values()) {
        clearTimeout(entry.timer);
      }
      timers.clear();
      failures.clear();
      renewedAt.clear();
      inflight.clear();
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
        renewedAtRef.current.delete(id);
      }
    }

    for (const account of stored.accounts) {
      if (timers.get(account.id)?.token === account.token) {
        continue;
      }
      const delay = renewalDelay(account.token);
      if (delay === undefined) {
        continue;
      }
      const renewNow = isRenewalDue(account.token) && !recentlyRenewed(account.id);
      armRenewal(account.id, account.token, renewNow ? 0 : delay);
    }
  }, [stored.accounts, armRenewal, recentlyRenewed]);

  const loginOptionsKey = loginPickerEnabled ? `auth-users:${apiBaseUrl}:${projectId}` : null;
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
        const { token } = await authApi.refresh(projectId, account.refreshToken);
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
      getAccessToken,
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
      getAccessToken,
      revokeError,
      clearRevokeError,
    ],
  );
}

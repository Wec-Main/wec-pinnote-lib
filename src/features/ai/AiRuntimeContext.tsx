import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AiStreamHub, type AiReconnectListener, type AiStreamListener } from "./AiStreamHub";
import { useAiStreamConnection, type AiStreamReconnect } from "../../hooks/useAiStream";
import { useTokenGetter } from "../../hooks/useTokenGetter";
import { fetchAiMe } from "../../services/aiService";
import { AnnotationApiError } from "../../types/annotation.types";
import { computeBackoffDelay, withJitter } from "../../utils/backoff";
import { aiMeCacheKey } from "./cacheKeys";
import {
  fetchResource,
  mutateResource,
  readResource,
  removeResource,
} from "../../utils/resourceCache";
import {
  AI_ACTIVE_TURN_STATUSES,
  type AiConnector,
  type AiMe,
  type AiStreamEvent,
} from "../../types/ai.types";
import type { StreamConnectionState } from "../../types/stream.types";

export interface AiRuntimeContextValue {
  apiBaseUrl: string;
  projectId: string;
  enabled: boolean;
  currentUserId: string | null;
  getToken: () => Promise<string | undefined>;
  me: AiMe | null;
  meLoading: boolean;
  meError: string | null;
  meRetrying: boolean;
  refreshMe: () => void;
  mergeConnectors: (connectors: AiConnector[]) => void;
  subscribe: (listener: AiStreamListener, onReconnect?: AiReconnectListener) => () => void;
  connection: StreamConnectionState;
  reconnect: () => void;
}

export type AiRuntimeActions = Pick<
  AiRuntimeContextValue,
  | "apiBaseUrl"
  | "projectId"
  | "enabled"
  | "currentUserId"
  | "getToken"
  | "refreshMe"
  | "mergeConnectors"
  | "subscribe"
> & { reconnect: () => void };

export type AiRuntimeState = Pick<
  AiRuntimeContextValue,
  "me" | "meLoading" | "meError" | "meRetrying" | "connection"
>;

export const AiRuntimeContext = createContext<AiRuntimeContextValue | null>(null);
export const AiRuntimeActionsContext = createContext<AiRuntimeActions | null>(null);
export const AiRuntimeStateContext = createContext<AiRuntimeState | null>(null);
const AiRuntimeMeContext = createContext<AiMe | null | undefined>(undefined);

export interface AiRuntimeProviderProps {
  apiBaseUrl: string;
  projectId: string;
  getAuthToken: (() => string | Promise<string>) | undefined;
  enabled: boolean;
  sessionKey?: string | null;
  currentUserId?: string | null;
  children?: ReactNode;
}

const ME_RETRY_BASE_MS = 2000;
const ME_RETRY_MAX_MS = 30000;
const ME_TTL_MS = 20000;

export function isRetryableAiMeError(err: unknown): boolean {
  if (!(err instanceof AnnotationApiError)) return true;
  return err.status === 408 || err.status === 429 || err.status >= 500;
}

export function mergeAiConnectors(current: AiConnector[], updates: AiConnector[]): AiConnector[] {
  const byProvider = new Map(updates.map((connector) => [connector.provider, connector]));
  const merged = current.map((connector) => byProvider.get(connector.provider) ?? connector);
  for (const connector of updates) {
    if (!current.some((existing) => existing.provider === connector.provider)) {
      merged.push(connector);
    }
  }
  return merged;
}

export function mergeAiMeConnectors(me: AiMe, connectors: AiConnector[]): AiMe {
  return { ...me, connectors: mergeAiConnectors(me.connectors ?? [], connectors) };
}

function describe(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Could not reach the server";
}

export function AiRuntimeProvider({
  apiBaseUrl,
  projectId,
  getAuthToken,
  enabled,
  sessionKey = null,
  currentUserId = null,
  children,
}: AiRuntimeProviderProps) {
  const getToken = useTokenGetter(getAuthToken);
  const [hub] = useState(() => new AiStreamHub());
  const meCacheKey = aiMeCacheKey(apiBaseUrl, projectId, sessionKey);
  const meCacheKeyRef = useRef(meCacheKey);
  meCacheKeyRef.current = meCacheKey;
  const [me, setMe] = useState<AiMe | null>(() =>
    enabled && projectId ? (readResource<AiMe>(meCacheKey).data ?? null) : null,
  );
  const [meLoading, setMeLoading] = useState(false);
  const [meError, setMeError] = useState<string | null>(null);
  const [meToken, setMeToken] = useState(0);
  const [meRetryAttempt, setMeRetryAttempt] = useState(0);
  const [meRetrying, setMeRetrying] = useState(false);

  const refreshMe = useCallback(() => setMeToken((token) => token + 1), []);
  const meKey = `${apiBaseUrl}|${projectId}|${sessionKey ?? ""}`;
  const meKeyRef = useRef(meKey);

  useEffect(() => {
    if (meKeyRef.current !== meKey) {
      meKeyRef.current = meKey;
      setMe(readResource<AiMe>(meCacheKey).data ?? null);
    }
    if (!enabled || !projectId) {
      setMe(null);
      setMeLoading(false);
      setMeError(null);
      setMeRetrying(false);
      return;
    }
    const controller = new AbortController();
    const cached = readResource<AiMe>(meCacheKey);
    if (cached.hasData && cached.data) setMe(cached.data);
    setMeLoading(true);
    void fetchResource<AiMe>(
      meCacheKey,
      (signal) =>
        getToken().then((authToken) => fetchAiMe(apiBaseUrl, authToken, projectId, signal)),
      { retries: 0, ttlMs: ME_TTL_MS, force: meToken > 0 },
    ).then(() => {
      if (controller.signal.aborted) return;
      const snapshot = readResource<AiMe>(meCacheKey);
      if (snapshot.error) {
        const retryable = isRetryableAiMeError(snapshot.error);
        if (!retryable) {
          setMe(null);
          removeResource(meCacheKey);
        }
        setMeError(describe(snapshot.error));
        setMeLoading(false);
        setMeRetrying(retryable);
        return;
      }
      if (snapshot.data) setMe(snapshot.data);
      setMeError(null);
      setMeLoading(false);
      setMeRetryAttempt(0);
      setMeRetrying(false);
    });
    return () => controller.abort();
  }, [apiBaseUrl, enabled, getToken, meKey, meCacheKey, meToken, projectId, sessionKey]);

  useEffect(() => {
    if (!enabled || !meRetrying) return;
    const delay = withJitter(
      computeBackoffDelay(meRetryAttempt, { baseMs: ME_RETRY_BASE_MS, maxMs: ME_RETRY_MAX_MS }),
    );
    const retry = () => {
      setMeRetryAttempt((attempt) => attempt + 1);
      refreshMe();
    };
    const timer = window.setTimeout(retry, delay);
    const onVisible = () => {
      if (document.visibilityState === "visible") retry();
    };
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, meRetrying, meRetryAttempt, refreshMe]);

  const mergeConnectors = useCallback((connectors: AiConnector[]) => {
    setMe((current) => (current ? mergeAiMeConnectors(current, connectors) : current));
    const key = meCacheKeyRef.current;
    const cached = readResource<AiMe>(key).data;
    if (cached) {
      mutateResource<AiMe>(key, mergeAiMeConnectors(cached, connectors));
    }
  }, []);

  const activeTurnsRef = useRef(new Set<string>());
  const lastDeltaAtRef = useRef(0);
  const keepAlive = useCallback(
    () => activeTurnsRef.current.size > 0 || Date.now() - lastDeltaAtRef.current < 45000,
    [],
  );

  const handleEvent = useCallback(
    (event: AiStreamEvent) => {
      if (event.type === "ai_delta") {
        lastDeltaAtRef.current = Date.now();
      } else if (event.type === "ai_turn.upserted") {
        if (AI_ACTIVE_TURN_STATUSES.includes(event.turn.status)) {
          activeTurnsRef.current.add(event.turn.aiTurnId);
        } else {
          activeTurnsRef.current.delete(event.turn.aiTurnId);
        }
      }
      if (event.type === "ai_connectors.updated") {
        mergeConnectors(event.connectors);
      } else if (
        event.type === "ai_connector_login.updated" &&
        event.state === "succeeded" &&
        event.connector
      ) {
        mergeConnectors([event.connector]);
      }
      hub.emit(event);
    },
    [hub, mergeConnectors],
  );

  const handleReconnect = useCallback(
    (reconnect: AiStreamReconnect) => {
      if (!reconnect.resumed) activeTurnsRef.current.clear();
      refreshMe();
      hub.reconnected(reconnect);
    },
    [hub, refreshMe],
  );

  const meUnavailable = me === null && meError !== null && !meRetrying;
  const { state: connection, reconnect } = useAiStreamConnection({
    apiBaseUrl,
    projectId,
    getAuthToken,
    enabled: enabled && !meUnavailable,
    onEvent: handleEvent,
    onReconnect: handleReconnect,
    keepAlive,
  });

  const subscribe = useCallback(
    (listener: AiStreamListener, onReconnect?: AiReconnectListener) =>
      hub.subscribe(listener, onReconnect),
    [hub],
  );

  const actions = useMemo<AiRuntimeActions>(
    () => ({
      apiBaseUrl,
      projectId,
      enabled,
      currentUserId,
      getToken,
      refreshMe,
      mergeConnectors,
      subscribe,
      reconnect,
    }),
    [
      apiBaseUrl,
      projectId,
      enabled,
      currentUserId,
      getToken,
      refreshMe,
      mergeConnectors,
      subscribe,
      reconnect,
    ],
  );

  const volatile = useMemo<AiRuntimeState>(
    () => ({ me, meLoading, meError, meRetrying, connection }),
    [me, meLoading, meError, meRetrying, connection],
  );

  const value = useMemo<AiRuntimeContextValue>(
    () => ({ ...actions, ...volatile }),
    [actions, volatile],
  );

  return (
    <AiRuntimeActionsContext.Provider value={actions}>
      <AiRuntimeStateContext.Provider value={volatile}>
        <AiRuntimeMeContext.Provider value={me}>
          <AiRuntimeContext.Provider value={value}>{children}</AiRuntimeContext.Provider>
        </AiRuntimeMeContext.Provider>
      </AiRuntimeStateContext.Provider>
    </AiRuntimeActionsContext.Provider>
  );
}

const DetachedRuntimeContext = createContext<AiRuntimeContextValue | null>(null);

function useLegacyActions(split: boolean): AiRuntimeActions | null {
  const legacy = useContext(split ? DetachedRuntimeContext : AiRuntimeContext);
  return useMemo(
    () => (legacy ? { ...legacy, reconnect: legacy.reconnect ?? noopReconnect } : null),
    [legacy],
  );
}

export function useAiRuntimeActions(): AiRuntimeActions {
  const actions = useContext(AiRuntimeActionsContext);
  const legacy = useLegacyActions(actions !== null);
  if (actions) return actions;
  if (!legacy) {
    throw new Error("useAiRuntimeActions must be used within AiRuntimeProvider");
  }
  return legacy;
}

export function useAiRuntimeState(): AiRuntimeState {
  const state = useContext(AiRuntimeStateContext);
  const legacy = useContext(state ? DetachedRuntimeContext : AiRuntimeContext);
  if (state) return state;
  if (!legacy) {
    throw new Error("useAiRuntimeState must be used within AiRuntimeProvider");
  }
  return legacy;
}

export function useOptionalAiRuntimeActions(): AiRuntimeActions | null {
  const actions = useContext(AiRuntimeActionsContext);
  const legacy = useLegacyActions(actions !== null);
  return actions ?? legacy;
}

function noopReconnect(): void {}

export function useAiRuntime(): AiRuntimeContextValue {
  const value = useContext(AiRuntimeContext);
  if (!value) {
    throw new Error("useAiRuntime must be used within AiRuntimeProvider");
  }
  return value;
}

export function useAiReconnect(): () => void {
  const actions = useContext(AiRuntimeActionsContext);
  return actions ? actions.reconnect : noopReconnect;
}

export function useOptionalAiRuntime(): AiRuntimeContextValue | null {
  return useContext(AiRuntimeContext);
}

export function useOptionalAiMe(): AiMe | null {
  const me = useContext(AiRuntimeMeContext);
  const legacy = useContext(me === undefined ? AiRuntimeContext : DetachedRuntimeContext);
  return me === undefined ? (legacy?.me ?? null) : me;
}

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";

export type PageScopedFetcher<T> = (
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  pageKey: string,
  projectVersionId: string | undefined,
  signal: AbortSignal,
) => Promise<T[]>;

export interface UsePageScopedResourceOptions<T> {
  apiBaseUrl: string;
  getToken: () => Promise<string | undefined>;
  projectId: string;
  projectVersionId?: string;
  pageKey: string;
  sessionKey: string | null;
  enabled: boolean;
  fetchItems: PageScopedFetcher<T>;
  loadErrorMessage: string;
  // Runs when the page/project/session scope changes, after items/error are
  // reset — for clearing any hook-specific draft state tied to that scope.
  onScopeChange?: () => void;
  // Runs when the resource becomes disabled, after items are cleared — for
  // clearing any hook-specific selection tied to the loaded items.
  onDisabled?: () => void;
}

export interface PageScopedResource<T> {
  items: T[];
  setItems: Dispatch<SetStateAction<T[]>>;
  itemsRef: MutableRefObject<T[]>;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  reload: () => void;
  // True when `incomingVersionId` names a project version other than the
  // one currently in view — for dropping stream/event updates that belong
  // to a version the page has since navigated away from.
  isStaleVersion: (incomingVersionId: string | null | undefined) => boolean;
}

export function usePageScopedResource<T>(
  options: UsePageScopedResourceOptions<T>,
): PageScopedResource<T> {
  const {
    apiBaseUrl,
    getToken,
    projectId,
    projectVersionId,
    pageKey,
    sessionKey,
    enabled,
    fetchItems,
    loadErrorMessage,
    onScopeChange,
    onDisabled,
  } = options;

  const [items, setItems] = useState<T[]>([]);
  const itemsRef = useRef<T[]>(items);
  itemsRef.current = items;
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const projectVersionIdRef = useRef(projectVersionId);
  projectVersionIdRef.current = projectVersionId;

  const onScopeChangeRef = useRef(onScopeChange);
  onScopeChangeRef.current = onScopeChange;
  const onDisabledRef = useRef(onDisabled);
  onDisabledRef.current = onDisabled;

  useEffect(() => {
    setItems([]);
    setError(null);
    onScopeChangeRef.current?.();
  }, [projectId, pageKey, sessionKey]);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      onDisabledRef.current?.();
      return;
    }
    const controller = new AbortController();
    getToken()
      .then((token) =>
        fetchItems(apiBaseUrl, token, projectId, pageKey, projectVersionId, controller.signal),
      )
      .then((loaded) => {
        if (controller.signal.aborted) {
          return;
        }
        setItems(loaded);
        setError(null);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(loadErrorMessage);
        }
      });
    return () => controller.abort();
  }, [
    apiBaseUrl,
    getToken,
    sessionKey,
    projectId,
    projectVersionId,
    pageKey,
    enabled,
    reloadToken,
    fetchItems,
    loadErrorMessage,
  ]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const isStaleVersion = useCallback((incomingVersionId: string | null | undefined) => {
    const viewed = projectVersionIdRef.current;
    return Boolean(viewed && incomingVersionId && incomingVersionId !== viewed);
  }, []);

  return { items, setItems, itemsRef, error, setError, reload, isStaleVersion };
}

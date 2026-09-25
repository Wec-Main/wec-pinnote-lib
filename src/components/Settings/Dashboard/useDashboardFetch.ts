import { useEffect, useRef, useState } from "react";
import { useAnnotationContext } from "../../../context/AnnotationContext";

export interface DashboardFetchState<T> {
  data: T | null;
  loading: boolean;
  loaded: boolean;
  error: string | null;
}

type DashboardLoader<T> = (
  apiBaseUrl: string,
  authToken: string | undefined,
  signal: AbortSignal,
) => Promise<T>;

export function useDashboardFetch<T>(
  params: readonly unknown[],
  load: DashboardLoader<T>,
  fallbackMessage: string,
): DashboardFetchState<T> {
  const { config, activeAccount } = useAnnotationContext();
  const authToken = activeAccount?.token;
  const apiBaseUrl = config.apiBaseUrl;
  const loadRef = useRef(load);
  loadRef.current = load;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    loadRef
      .current(apiBaseUrl, authToken, controller.signal)
      .then((result) => {
        setData(result);
        setLoading(false);
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setError(err instanceof Error ? err.message : fallbackMessage);
        setLoading(false);
      });

    return () => controller.abort();
  }, [apiBaseUrl, authToken, paramsKey, fallbackMessage]);

  return { data, loading, loaded, error };
}

export function useKnownTotal(total: number | null | undefined): number {
  const [knownTotal, setKnownTotal] = useState(0);
  if (typeof total === "number" && total !== knownTotal) {
    setKnownTotal(total);
  }
  return typeof total === "number" ? total : knownTotal;
}

import { useMemo } from "react";
import { DEFAULT_PINNOTE_API_URL } from "../config/env";
import { createEpicFlowApi, type EpicFlowApiClient } from "../services/epicFlowService";
import type { AnnotationConfig } from "../types/annotation.types";
import { useTokenGetter } from "./useTokenGetter";

export function useEpicFlowApi(
  config: Pick<AnnotationConfig, "apiBaseUrl" | "getAuthToken">,
): EpicFlowApiClient {
  const apiBaseUrl = config.apiBaseUrl ?? DEFAULT_PINNOTE_API_URL;
  const { getAuthToken } = config;
  const getToken = useTokenGetter(getAuthToken);

  return useMemo(() => {
    return createEpicFlowApi({
      apiBaseUrl,
      getAuthToken: async () => (await getToken()) ?? "",
    });
  }, [apiBaseUrl, getToken]);
}

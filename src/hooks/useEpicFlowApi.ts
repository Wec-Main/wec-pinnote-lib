import { useMemo } from "react";
import { createEpicFlowApi, type EpicFlowApiClient } from "../services/epicFlowApi";
import type { AnnotationConfig } from "../types/annotation.types";
import { useTokenGetter } from "./useTokenGetter";

export function useEpicFlowApi(
  config: Pick<AnnotationConfig, "apiBaseUrl" | "getAuthToken">,
): EpicFlowApiClient {
  const { apiBaseUrl, getAuthToken } = config;
  const getToken = useTokenGetter(getAuthToken);

  return useMemo(() => {
    return createEpicFlowApi({
      apiBaseUrl,
      getAuthToken: async () => (await getToken()) ?? "",
    });
  }, [apiBaseUrl, getToken]);
}

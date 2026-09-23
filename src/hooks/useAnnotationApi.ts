import { useMemo } from "react";
import { createAnnotationApi } from "../services/annotationApi";
import type { AnnotationApiClient, AnnotationConfig } from "../types/annotation.types";
import { useTokenGetter } from "./useTokenGetter";

export function useAnnotationApi(
  config: Pick<AnnotationConfig, "apiBaseUrl" | "getAuthToken" | "apiClient">,
): AnnotationApiClient {
  const { apiBaseUrl, getAuthToken, apiClient } = config;
  const getToken = useTokenGetter(getAuthToken);

  return useMemo(() => {
    if (apiClient) {
      return apiClient;
    }
    return createAnnotationApi({
      apiBaseUrl,
      getAuthToken: async () => (await getToken()) ?? "",
    });
  }, [apiBaseUrl, apiClient, getToken]);
}

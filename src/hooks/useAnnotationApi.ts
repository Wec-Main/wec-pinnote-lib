import { useMemo, useRef } from "react";
import { createAnnotationApi } from "../services/annotationApi";
import type { AnnotationApiClient, AnnotationConfig } from "../types/annotation.types";

export function useAnnotationApi(
  config: Pick<AnnotationConfig, "apiBaseUrl" | "getAuthToken" | "apiClient">,
): AnnotationApiClient {
  const { apiBaseUrl, getAuthToken, apiClient } = config;
  const tokenRef = useRef(getAuthToken);
  tokenRef.current = getAuthToken;

  return useMemo(() => {
    if (apiClient) {
      return apiClient;
    }
    return createAnnotationApi({
      apiBaseUrl,
      getAuthToken: async () => {
        const token = await tokenRef.current?.();
        return token ?? "";
      },
    });
  }, [apiBaseUrl, apiClient]);
}

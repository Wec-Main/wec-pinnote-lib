import { useMemo, useRef } from "react";
import { createEpicFlowApi, type EpicFlowApiClient } from "../services/epicFlowApi";
import type { AnnotationConfig } from "../types/annotation.types";

export function useEpicFlowApi(
  config: Pick<AnnotationConfig, "apiBaseUrl" | "getAuthToken">,
): EpicFlowApiClient {
  const { apiBaseUrl, getAuthToken } = config;
  const tokenRef = useRef(getAuthToken);
  tokenRef.current = getAuthToken;

  return useMemo(() => {
    return createEpicFlowApi({
      apiBaseUrl,
      getAuthToken: async () => {
        const token = await tokenRef.current?.();
        return token ?? "";
      },
    });
  }, [apiBaseUrl]);
}

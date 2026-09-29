import type { Annotation, AnnotationApiClient } from "../types/annotation.types";
import { errorMessage } from "./useAnnotations";
import { useSharedFetch } from "./useSharedFetch";

export interface AllProjectAnnotationsOptions {
  api: AnnotationApiClient;
  apiBaseUrl: string;
  projectId: string;
  projectVersionId: string | undefined;
  authenticated: boolean;
  sessionKey: string | null;
}

export function useAllProjectAnnotations({
  api,
  apiBaseUrl,
  projectId,
  projectVersionId,
  authenticated,
  sessionKey,
}: AllProjectAnnotationsOptions) {
  const key =
    authenticated && sessionKey
      ? `all-annotations:${apiBaseUrl}:${sessionKey}:${projectId}:${projectVersionId ?? ""}`
      : null;
  const { data, loading, error, reload } = useSharedFetch<Annotation[]>(key, (signal) =>
    api.listAnnotations({ projectId, projectVersionId }, signal),
  );
  return { annotations: data ?? [], loading, error: error ? errorMessage(error) : null, reload };
}

import { useCallback, useMemo, useState } from "react";
import { useAnnotationAuth, useAnnotationData } from "../context/AnnotationContext";
import { listDataModels } from "../services/erdService";
import { listAllFlows } from "../services/flowchartService";
import type { ReferenceCandidate } from "../utils/mentions";
import { useEpicFlowApi } from "./useEpicFlowApi";
import { useSharedFetch } from "./useSharedFetch";
import { useTokenGetter } from "./useTokenGetter";

const EPIC_STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  in_progress: "In progress",
  done: "Done",
  archived: "Archived",
};

export interface ReferenceCandidatesResult {
  references: ReferenceCandidate[];
  loading: boolean;
  request: () => void;
}

export function useReferenceCandidates(): ReferenceCandidatesResult {
  const { config, flowsVersionId } = useAnnotationData();
  const { hostAuthenticated, activeAccount } = useAnnotationAuth();
  const getToken = useTokenGetter(config.getAuthToken);
  const epicApi = useEpicFlowApi(config);
  const [requested, setRequested] = useState(false);
  const request = useCallback(() => setRequested(true), []);

  const sessionKey = hostAuthenticated ? "host" : (activeAccount?.id ?? "");
  const scope =
    requested && sessionKey ? `${config.apiBaseUrl}:${sessionKey}:${config.projectId}` : null;

  const flows = useSharedFetch(scope && `flows-list:${scope}:${flowsVersionId ?? ""}`, (signal) =>
    getToken().then((authToken) =>
      listAllFlows(config.apiBaseUrl, authToken, config.projectId, flowsVersionId, signal),
    ),
  );
  const dataModels = useSharedFetch(scope && `data-models-list:${scope}`, (signal) =>
    getToken().then((authToken) =>
      listDataModels(config.apiBaseUrl, authToken, config.projectId, signal),
    ),
  );
  const epics = useSharedFetch(scope && `epics-list:${scope}`, (signal) =>
    epicApi.getEpics(config.projectId, signal),
  );

  const references = useMemo<ReferenceCandidate[]>(
    () => [
      ...(epics.data ?? []).map((epic) => ({
        kind: "epic" as const,
        id: epic.id,
        name: epic.title,
        description: EPIC_STATUS_LABELS[epic.status] ?? epic.status,
      })),
      ...(flows.data ?? []).map((flow) => ({
        kind: "flow" as const,
        id: flow.id,
        name: flow.name,
        description: flow.pinPageKey ?? undefined,
      })),
      ...(dataModels.data ?? []).map((model) => ({
        kind: "dataModel" as const,
        id: model.id,
        name: model.name,
        description: `${model.entityCount} ${model.entityCount === 1 ? "entity" : "entities"}`,
      })),
    ],
    [dataModels.data, epics.data, flows.data],
  );

  return {
    references,
    loading: epics.loading || flows.loading || dataModels.loading,
    request,
  };
}

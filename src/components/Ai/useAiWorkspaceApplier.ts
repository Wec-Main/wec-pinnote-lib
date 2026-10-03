import { useCallback, useMemo } from "react";
import {
  applyWorkspaceOps,
  type WorkspaceApplyDeps,
  type WorkspaceApplyItem,
  type WorkspaceApplyResult,
} from "../../ai/ops/workspaceOps";
import { useAiRuntime } from "../../context/AiRuntimeContext";
import { useAnnotationData } from "../../context/AnnotationContext";
import { useEpicFlowApi } from "../../hooks/useEpicFlowApi";
import { updateAiOpBatch } from "../../services/aiApi";
import { createFlow, fetchFlowDocument, saveFlowDocument } from "../../services/flowApi";
import {
  createDataModel,
  fetchDataModelDocument,
  saveDataModelDocument,
} from "../../services/dataModelApi";
import type { AiOpBatch } from "../../types/ai.types";

export type AiWorkspaceBatch = Extract<AiOpBatch, { targetKind: "workspace" }>;

export const isWorkspaceBatch = (batch: AiOpBatch): batch is AiWorkspaceBatch =>
  batch.targetKind === "workspace";

export interface AiWorkspaceApplier {
  apply: (
    batch: AiWorkspaceBatch,
    onProgress?: (items: readonly WorkspaceApplyItem[]) => void,
  ) => Promise<WorkspaceApplyResult>;
  discard: (batch: AiWorkspaceBatch) => Promise<void>;
}

export function summarizeWorkspaceResult(result: WorkspaceApplyResult): string {
  const count = (kind: WorkspaceApplyItem["kind"], action: WorkspaceApplyItem["action"]) =>
    result.items.filter(
      (item) => item.status === "done" && item.kind === kind && item.action === action,
    ).length;
  const parts: string[] = [];
  const add = (n: number, one: string, many: string) => {
    if (n > 0) parts.push(`${n} ${n === 1 ? one : many}`);
  };
  add(count("epic", "created"), "epic created", "epics created");
  add(count("user_story", "created"), "user story created", "user stories created");
  add(count("flow", "created"), "flow created", "flows created");
  add(count("data_model", "created"), "data model created", "data models created");
  add(count("epic", "updated"), "epic updated", "epics updated");
  add(count("user_story", "updated"), "user story updated", "user stories updated");
  return parts.join(", ");
}

export function useAiWorkspaceApplier(): AiWorkspaceApplier {
  const { apiBaseUrl, projectId, getToken } = useAiRuntime();
  const { config, flowsVersionId } = useAnnotationData();
  const epicApi = useEpicFlowApi(config);

  const deps = useCallback(async (): Promise<WorkspaceApplyDeps> => {
    const [epics, stories] = await Promise.all([
      epicApi.getEpics(projectId),
      epicApi.getUserStoriesByProject(projectId),
    ]);
    return {
      epics: epics.map((epic) => ({ id: epic.id, title: epic.title })),
      stories: stories.map((story) => ({ id: story.id, title: story.title })),
      async board(items) {
        const result = await epicApi.batchBoard(projectId, items);
        return result.items.map((item) => ({ id: item.id }));
      },
      async createEpic(input) {
        const epic = await epicApi.createEpic({ projectId, ...input });
        return { id: epic.id };
      },
      async updateEpic(id, input) {
        const current = epics.find((epic) => epic.id === id);
        await epicApi.updateEpic(id, {
          title: input.title ?? current?.title ?? "",
          description: input.description ?? current?.description ?? "",
        });
      },
      async createUserStory(epicId, input) {
        const story = await epicApi.createUserStory(epicId, input);
        return { id: story.id };
      },
      async updateUserStory(id, input) {
        const current = stories.find((story) => story.id === id);
        await epicApi.updateUserStory(id, {
          title: input.title ?? current?.title ?? "",
          description: input.description ?? current?.description ?? "",
        });
      },
      async createFlow(input) {
        const flow = await createFlow(apiBaseUrl, await getToken(), projectId, {
          ...input,
          projectVersionId: flowsVersionId,
        });
        return { id: flow.id };
      },
      async loadFlow(id) {
        const record = await fetchFlowDocument(apiBaseUrl, await getToken(), id);
        return { revision: record.revision, document: record.document };
      },
      async saveFlow(id, revision, document) {
        await saveFlowDocument(apiBaseUrl, await getToken(), id, revision, document);
      },
      async createDataModel(input) {
        const model = await createDataModel(apiBaseUrl, await getToken(), projectId, {
          name: input.name,
          description: input.description,
          engine: input.engine ?? "na",
        });
        return { id: model.id };
      },
      async loadDataModel(id) {
        const record = await fetchDataModelDocument(apiBaseUrl, await getToken(), id);
        return { revision: record.revision, document: record.document };
      },
      async saveDataModel(id, revision, document) {
        await saveDataModelDocument(apiBaseUrl, await getToken(), id, revision, document);
      },
    };
  }, [apiBaseUrl, epicApi, flowsVersionId, getToken, projectId]);

  const apply = useCallback<AiWorkspaceApplier["apply"]>(
    async (batch, onProgress) => {
      const token = await getToken();
      if (batch.status === "proposed" || batch.status === "conflict") {
        await updateAiOpBatch(apiBaseUrl, token, batch.aiOpBatchId, { status: "applied" });
      }
      const result = await applyWorkspaceOps(batch.ops, await deps(), onProgress);
      const detail = result.items
        .filter((item) => item.status !== "done")
        .map((item) => `${item.label}: ${item.error ?? "failed"}`)
        .join("; ")
        .slice(0, 1800);
      if (result.done === 0) {
        await updateAiOpBatch(apiBaseUrl, token, batch.aiOpBatchId, {
          status: "conflict",
          statusDetail: detail || "Nothing could be created",
        });
      } else {
        await updateAiOpBatch(apiBaseUrl, token, batch.aiOpBatchId, {
          status: "saved",
          savedRevision: 0,
          ...(detail ? { statusDetail: detail } : {}),
        });
      }
      return result;
    },
    [apiBaseUrl, deps, getToken],
  );

  const discard = useCallback<AiWorkspaceApplier["discard"]>(
    async (batch) => {
      await updateAiOpBatch(apiBaseUrl, await getToken(), batch.aiOpBatchId, {
        status: "rejected",
      });
    },
    [apiBaseUrl, getToken],
  );

  return useMemo(() => ({ apply, discard }), [apply, discard]);
}

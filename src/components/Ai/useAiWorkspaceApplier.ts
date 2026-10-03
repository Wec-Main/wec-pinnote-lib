import { useCallback, useMemo } from "react";
import {
  applyWorkspaceOps,
  type WorkspaceApplyDeps,
  type WorkspaceApplyItem,
  type WorkspaceApplyResult,
  type WorkspaceResumeEntry,
} from "../../ai/ops/workspaceOps";
import {
  clearWorkspaceResume,
  loadWorkspaceResume,
  saveWorkspaceResume,
} from "../../ai/workspaceResumeStore";
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
import type { AiOpBatch, UpdateAiOpBatchRequest } from "../../types/ai.types";

export type AiWorkspaceBatch = Extract<AiOpBatch, { targetKind: "workspace" }>;

export const isWorkspaceBatch = (batch: AiOpBatch): batch is AiWorkspaceBatch =>
  batch.targetKind === "workspace";

export type AiWorkspaceApplyResult = WorkspaceApplyResult & { syncWarning?: string };

export class WorkspaceBatchBusyError extends Error {
  constructor() {
    super("This proposal is already being applied elsewhere. Refresh to see the result.");
    this.name = "WorkspaceBatchBusyError";
  }
}

const httpStatus = (err: unknown): number | null => {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : null;
};

export async function claimWorkspaceBatch(
  update: (status: "applying" | "applied") => Promise<unknown>,
  currentStatus: string,
  resumed: boolean,
): Promise<void> {
  if (currentStatus === "applying" && !resumed) throw new WorkspaceBatchBusyError();
  if (currentStatus !== "proposed" && currentStatus !== "conflict") return;
  const attempt = async (status: "applying" | "applied"): Promise<"ok" | "held"> => {
    try {
      await update(status);
      return "ok";
    } catch (err) {
      if (httpStatus(err) === 409) {
        if (resumed) return "held";
        throw new WorkspaceBatchBusyError();
      }
      throw err;
    }
  };
  try {
    await attempt("applying");
  } catch (err) {
    if (err instanceof WorkspaceBatchBusyError || httpStatus(err) === null) throw err;
    await attempt("applied");
  }
}

export async function retryAsync<T>(
  run: () => Promise<T>,
  attempts = 3,
  delayMs = 400,
): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await run();
    } catch (err) {
      last = err;
      const status = httpStatus(err);
      if (status !== null && status >= 400 && status < 500 && status !== 408 && status !== 429) {
        throw err;
      }
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * 2 ** attempt));
      }
    }
  }
  throw last;
}

export interface AiWorkspaceApplier {
  apply: (
    batch: AiWorkspaceBatch,
    onProgress?: (items: readonly WorkspaceApplyItem[]) => void,
  ) => Promise<AiWorkspaceApplyResult>;
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

  const deps = useCallback(
    async (batch: AiWorkspaceBatch): Promise<WorkspaceApplyDeps> => {
      const needsEpics = batch.ops.some(
        (op) => op.op === "updateEpic" || op.op === "createUserStory",
      );
      const needsStories = batch.ops.some((op) => op.op === "updateUserStory");
      const [epics, stories] = await Promise.all([
        needsEpics ? epicApi.getEpics(projectId) : Promise.resolve([]),
        needsStories ? epicApi.getUserStoriesByProject(projectId) : Promise.resolve([]),
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
    },
    [apiBaseUrl, epicApi, flowsVersionId, getToken, projectId],
  );

  const apply = useCallback<AiWorkspaceApplier["apply"]>(
    async (batch, onProgress) => {
      const token = await getToken();
      const send = (status: string, extra?: object) =>
        updateAiOpBatch(apiBaseUrl, token, batch.aiOpBatchId, {
          status: status as UpdateAiOpBatchRequest["status"],
          ...extra,
        });
      const resume = loadWorkspaceResume(batch.aiOpBatchId);
      await claimWorkspaceBatch(send, batch.status, resume.size > 0);
      let resolved: WorkspaceApplyDeps;
      try {
        resolved = await deps(batch);
      } catch (err) {
        if (batch.status !== "applying" && resume.size === 0) {
          await send("proposed").catch(() => undefined);
        }
        throw err;
      }
      const result = await applyWorkspaceOps(batch.ops, resolved, onProgress, {
        resume,
        onCreated: (index: number, entry: WorkspaceResumeEntry) => {
          resume.set(index, entry);
          saveWorkspaceResume(batch.aiOpBatchId, resume);
        },
      });
      const detail = result.items
        .filter((item) => item.status !== "done")
        .map((item) => `${item.label}: ${item.error ?? "failed"}`)
        .join("; ")
        .slice(0, 1800);
      let syncWarning: string | undefined;
      try {
        if (result.done === 0) {
          await retryAsync(() =>
            send("conflict", { statusDetail: detail || "Nothing could be created" }),
          );
        } else {
          await retryAsync(async () => {
            try {
              await send("applied");
            } catch (err) {
              if (httpStatus(err) !== 409) throw err;
            }
            await send("saved", { savedRevision: 0, ...(detail ? { statusDetail: detail } : {}) });
          });
          if (result.failed === 0) clearWorkspaceResume(batch.aiOpBatchId);
        }
      } catch {
        syncWarning =
          "Applied, but the server could not be updated. Retrying will not duplicate items.";
      }
      return syncWarning ? { ...result, syncWarning } : result;
    },
    [apiBaseUrl, deps, getToken],
  );

  const discard = useCallback<AiWorkspaceApplier["discard"]>(
    async (batch) => {
      await updateAiOpBatch(apiBaseUrl, await getToken(), batch.aiOpBatchId, {
        status: "rejected",
      });
      clearWorkspaceResume(batch.aiOpBatchId);
    },
    [apiBaseUrl, getToken],
  );

  return useMemo(() => ({ apply, discard }), [apply, discard]);
}

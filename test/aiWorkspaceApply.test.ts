import { describe, expect, it } from "vitest";
import {
  applyWorkspaceOps,
  type WorkspaceApplyDeps,
  type WorkspaceOp,
} from "../src/features/ai/ops";
import type { WorkspaceResumeEntry } from "../src/features/ai/ops/workspaceOps";
import {
  clearWorkspaceResume,
  loadWorkspaceResume,
  saveWorkspaceResume,
} from "../src/features/ai/workspaceResumeStore";
import {
  WorkspaceBatchBusyError,
  claimWorkspaceBatch,
  retryAsync,
} from "../src/features/ai/components/useAiWorkspaceApplier";
import {
  postDraftOnce,
  postedDraftCount,
  resetPostedDrafts,
} from "../src/features/ai/components/useAiCardActions";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

function deps(failStoryOnce = false) {
  const log: string[] = [];
  let n = 0;
  let failed = false;
  const value: WorkspaceApplyDeps = {
    async createEpic(input) {
      log.push(`epic:${input.title}`);
      return { id: `epic-${++n}` };
    },
    async updateEpic() {},
    async createUserStory(epicId, input) {
      if (failStoryOnce && !failed) {
        failed = true;
        throw new Error("network");
      }
      log.push(`story:${epicId}:${input.title}`);
      return { id: `story-${++n}` };
    },
    async updateUserStory() {},
    async createFlow() {
      return { id: "flow" };
    },
    async loadFlow() {
      return { revision: 1, document: { version: 1, nodes: [], edges: [], meta: { name: "" } } };
    },
    async saveFlow() {},
    async createDataModel() {
      return { id: "model" };
    },
    async loadDataModel() {
      throw new Error("unused");
    },
    async saveDataModel() {},
  } as unknown as WorkspaceApplyDeps;
  return { value, log };
}

const ops: WorkspaceOp[] = [
  { op: "createEpic", tempId: "$e", title: "Checkout", description: "d" },
  { op: "createUserStory", epic: "$e", title: "Pay", description: "d" },
];

describe("applyWorkspaceOps idempotent resume", () => {
  it("does not recreate items that were already created on a retry", async () => {
    const store = new Map<number, WorkspaceResumeEntry>();
    const first = deps(true);
    const r1 = await applyWorkspaceOps(ops, first.value, undefined, {
      resume: store,
      onCreated: (index, entry) => store.set(index, entry),
    });
    expect(r1.failed).toBe(1);
    expect([...store.keys()]).toEqual([0]);

    const second = deps();
    const r2 = await applyWorkspaceOps(ops, second.value, undefined, {
      resume: store,
      onCreated: (index, entry) => store.set(index, entry),
    });
    expect(r2.failed).toBe(0);
    expect(second.log).toEqual(["story:epic-1:Pay"]);
  });

  it("round-trips the resume map through storage", () => {
    const storage = memoryStorage();
    saveWorkspaceResume("b1", new Map([[2, { id: "x", complete: false }]]), storage);
    expect(loadWorkspaceResume("b1", storage).get(2)).toEqual({ id: "x", complete: false });
    clearWorkspaceResume("b1", storage);
    expect(loadWorkspaceResume("b1", storage).size).toBe(0);
    expect(loadWorkspaceResume("b1", null).size).toBe(0);
  });
});

describe("claimWorkspaceBatch", () => {
  const http = (status: number) => Object.assign(new Error(`http ${status}`), { status });

  it("claims with applying when the server supports it", async () => {
    const sent: string[] = [];
    await claimWorkspaceBatch(async (s) => void sent.push(s), "proposed", false);
    expect(sent).toEqual(["applying"]);
  });

  it("falls back to applied when applying is rejected as unsupported", async () => {
    const sent: string[] = [];
    await claimWorkspaceBatch(
      async (s) => {
        sent.push(s);
        if (s === "applying") throw http(400);
      },
      "conflict",
      false,
    );
    expect(sent).toEqual(["applying", "applied"]);
  });

  it("aborts on 409 when someone else holds the batch", async () => {
    await expect(
      claimWorkspaceBatch(
        async () => {
          throw http(409);
        },
        "proposed",
        false,
      ),
    ).rejects.toBeInstanceOf(WorkspaceBatchBusyError);
    await expect(
      claimWorkspaceBatch(async () => undefined, "applying", false),
    ).rejects.toBeInstanceOf(WorkspaceBatchBusyError);
  });

  it("lets our own earlier attempt continue", async () => {
    await expect(
      claimWorkspaceBatch(
        async () => {
          throw http(409);
        },
        "proposed",
        true,
      ),
    ).resolves.toBeUndefined();
    await expect(
      claimWorkspaceBatch(async () => undefined, "applying", true),
    ).resolves.toBeUndefined();
  });

  it("rethrows network failures", async () => {
    await expect(
      claimWorkspaceBatch(
        async () => {
          throw new Error("offline");
        },
        "proposed",
        false,
      ),
    ).rejects.toThrow("offline");
  });
});

describe("retryAsync", () => {
  it("retries transient failures but not client errors", async () => {
    let calls = 0;
    await expect(
      retryAsync(
        async () => {
          if (++calls < 3) throw new Error("flaky");
          return "ok";
        },
        3,
        1,
      ),
    ).resolves.toBe("ok");
    let hits = 0;
    await expect(
      retryAsync(
        async () => {
          hits++;
          throw Object.assign(new Error("bad"), { status: 400 });
        },
        3,
        1,
      ),
    ).rejects.toThrow("bad");
    expect(hits).toBe(1);
  });
});

describe("postDraftOnce cache", () => {
  it("caps remembered comments and scopes by session", async () => {
    resetPostedDrafts();
    for (let i = 0; i < 250; i++) {
      await postDraftOnce(
        { aiCommentDraftId: `d${i}`, aiSessionId: "s1", postedCommentId: null },
        async () => ({ id: `c${i}` }),
        async () => undefined,
      );
    }
    expect(postedDraftCount()).toBe(200);
    let created = 0;
    await postDraftOnce(
      { aiCommentDraftId: "d249", aiSessionId: "s2", postedCommentId: null },
      async () => {
        created++;
        return { id: "other" };
      },
      async () => undefined,
    );
    expect(created).toBe(1);
  });
});

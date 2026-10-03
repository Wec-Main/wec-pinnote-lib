import { describe, expect, it } from "vitest";
import {
  applyWorkspaceOps,
  isWorkspaceOp,
  type WorkspaceApplyDeps,
  type WorkspaceOp,
} from "../src/ai/ops";
import { describeWorkspaceOps } from "../src/components/Ai/aiOpChanges";
import type { ErdDocumentJSON } from "../src/types/dataModel.types";
import type { FlowJSON } from "../src/types/flowchart.types";
import { createEmptyErdDocument } from "../src/utils/erd/erdSerialization";

interface Calls {
  log: string[];
  flowSaved: FlowJSON | null;
  modelSaved: ErdDocumentJSON | null;
  stories: { epicId: string; title: string }[];
  epicUpdates: { id: string; title?: string; description?: string }[];
}

function fakeDeps(overrides: Partial<WorkspaceApplyDeps> = {}) {
  const calls: Calls = { log: [], flowSaved: null, modelSaved: null, stories: [], epicUpdates: [] };
  let n = 0;
  const deps: WorkspaceApplyDeps = {
    epics: [{ id: "11111111-1111-4111-8111-111111111111", title: "Billing" }],
    stories: [{ id: "22222222-2222-4222-8222-222222222222", title: "Pay by card" }],
    async createEpic(input) {
      calls.log.push(`createEpic:${input.title}`);
      return { id: `epic-${++n}` };
    },
    async updateEpic(id, input) {
      calls.log.push(`updateEpic:${id}`);
      calls.epicUpdates.push({ id, ...input });
    },
    async createUserStory(epicId, input) {
      calls.log.push(`createUserStory:${input.title}`);
      calls.stories.push({ epicId, title: input.title });
      return { id: `story-${++n}` };
    },
    async updateUserStory(id) {
      calls.log.push(`updateUserStory:${id}`);
    },
    async createFlow(input) {
      calls.log.push(`createFlow:${input.name}`);
      return { id: `flow-${++n}` };
    },
    async loadFlow() {
      return {
        revision: 1,
        document: { version: 1, nodes: [], edges: [], meta: { name: "", edgeType: "step" } },
      };
    },
    async saveFlow(_id, revision, document) {
      calls.log.push(`saveFlow:${revision}`);
      calls.flowSaved = document;
    },
    async createDataModel(input) {
      calls.log.push(`createDataModel:${input.name}`);
      return { id: `model-${++n}` };
    },
    async loadDataModel(id) {
      void id;
      return { revision: 3, document: createEmptyErdDocument("na", "Shop") };
    },
    async saveDataModel(_id, revision, document) {
      calls.log.push(`saveDataModel:${revision}`);
      calls.modelSaved = document;
    },
    ...overrides,
  };
  return { deps, calls };
}

const flowOps = [
  { op: "addNode", tempId: "$s", type: "start", label: "Start" },
  { op: "addNode", tempId: "$p", type: "process", label: "Pay", near: "$s" },
  { op: "addEdge", source: "$s", target: "$p" },
];

describe("applyWorkspaceOps", () => {
  it("creates an epic and links its user stories through the tempId", async () => {
    const { deps, calls } = fakeDeps();
    const ops: WorkspaceOp[] = [
      { op: "createEpic", tempId: "$e", title: "Checkout", description: "Goal" },
      { op: "createUserStory", epic: "$e", title: "Add to cart", description: "As a buyer" },
      { op: "createUserStory", epic: "$e", title: "Pay", description: "As a buyer" },
    ];
    const result = await applyWorkspaceOps(ops, deps);
    expect(result.failed).toBe(0);
    expect(calls.stories).toEqual([
      { epicId: "epic-1", title: "Add to cart" },
      { epicId: "epic-1", title: "Pay" },
    ]);
    expect(result.items.map((item) => [item.kind, item.action, item.status])).toEqual([
      ["epic", "created", "done"],
      ["user_story", "created", "done"],
      ["user_story", "created", "done"],
    ]);
  });

  it("adds a story to an existing epic by id or by exact title", async () => {
    const { deps, calls } = fakeDeps();
    const result = await applyWorkspaceOps(
      [
        {
          op: "createUserStory",
          epic: "11111111-1111-4111-8111-111111111111",
          title: "A",
          description: "d",
        },
        { op: "createUserStory", epic: "billing", title: "B", description: "d" },
      ],
      deps,
    );
    expect(result.failed).toBe(0);
    expect(calls.stories.map((story) => story.epicId)).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "11111111-1111-4111-8111-111111111111",
    ]);
  });

  it("updates an existing epic and keeps untouched fields out of the patch", async () => {
    const { deps, calls } = fakeDeps();
    await applyWorkspaceOps(
      [{ op: "updateEpic", epic: "Billing", description: "New notes" }],
      deps,
    );
    expect(calls.epicUpdates).toEqual([
      { id: "11111111-1111-4111-8111-111111111111", title: undefined, description: "New notes" },
    ]);
  });

  it("skips stories whose epic failed and carries on with the rest", async () => {
    const { deps, calls } = fakeDeps({
      async createEpic() {
        throw new Error("Title is too long");
      },
    });
    const result = await applyWorkspaceOps(
      [
        { op: "createEpic", tempId: "$e", title: "X", description: "d" },
        { op: "createUserStory", epic: "$e", title: "Child", description: "d" },
        {
          op: "createUserStory",
          epic: "11111111-1111-4111-8111-111111111111",
          title: "Elsewhere",
          description: "d",
        },
      ],
      deps,
    );
    expect(result.items.map((item) => item.status)).toEqual(["failed", "skipped", "done"]);
    expect(result.items[0]?.error).toBe("Title is too long");
    expect(calls.stories.map((story) => story.title)).toEqual(["Elsewhere"]);
    expect(result).toMatchObject({ done: 1, failed: 2 });
  });

  it("fails an unknown epic reference without calling the API", async () => {
    const { deps, calls } = fakeDeps();
    const result = await applyWorkspaceOps(
      [{ op: "createUserStory", epic: "Nope", title: "T", description: "d" }],
      deps,
    );
    expect(result.items[0]).toMatchObject({ status: "failed" });
    expect(calls.log).toEqual([]);
  });

  it("builds a new flow from its ops and saves it with the loaded revision", async () => {
    const { deps, calls } = fakeDeps();
    const result = await applyWorkspaceOps(
      [{ op: "createFlow", tempId: "$f", name: "Checkout flow", ops: flowOps as never }],
      deps,
    );
    expect(result.failed).toBe(0);
    expect(calls.log).toEqual(["createFlow:Checkout flow", "saveFlow:1"]);
    expect(calls.flowSaved?.nodes.map((node) => node.data?.label)).toEqual(["Start", "Pay"]);
    expect(calls.flowSaved?.edges).toHaveLength(1);
    expect(calls.flowSaved?.meta?.name).toBe("Checkout flow");
  });

  it("never creates the flow when its ops are invalid", async () => {
    const { deps, calls } = fakeDeps();
    const result = await applyWorkspaceOps(
      [
        {
          op: "createFlow",
          name: "Broken",
          ops: [{ op: "addEdge", source: "$a", target: "$b" }] as never,
        },
      ],
      deps,
    );
    expect(result.items[0]?.status).toBe("failed");
    expect(calls.log).toEqual([]);
  });

  it("builds a new data model from its ops", async () => {
    const { deps, calls } = fakeDeps();
    const result = await applyWorkspaceOps(
      [
        {
          op: "createDataModel",
          name: "Shop",
          description: "Orders",
          ops: [
            { op: "setModelDescription", description: "Orders and payments" },
            { op: "addEntity", tempId: "$o", name: "Order" },
            { op: "addEntity", tempId: "$c", name: "Customer" },
            { op: "addRelationship", source: "$c", target: "$o", cardinality: "one-to-many" },
          ] as never,
        },
      ],
      deps,
    );
    expect(result.failed).toBe(0);
    expect(calls.log).toEqual(["createDataModel:Shop", "saveDataModel:3"]);
    expect(calls.modelSaved?.entities.map((entity) => entity.name)).toEqual(["Order", "Customer"]);
    expect(calls.modelSaved?.relationships).toHaveLength(1);
    expect(calls.modelSaved?.meta.description).toBe("Orders and payments");
  });

  it("reports progress after every operation", async () => {
    const { deps } = fakeDeps();
    const seen: number[] = [];
    await applyWorkspaceOps(
      [
        { op: "createEpic", title: "A", description: "d" },
        { op: "createEpic", title: "B", description: "d" },
      ],
      deps,
      (items) => seen.push(items.length),
    );
    expect(seen).toEqual([1, 2]);
  });
});

describe("applyWorkspaceOps with a board batch", () => {
  const E1 = "11111111-1111-4111-8111-111111111111";

  it("sends a whole run of epics and stories in one request, flows stay separate", async () => {
    const batches: unknown[][] = [];
    const { deps, calls } = fakeDeps({
      async board(items) {
        batches.push(items);
        return items.map((_, i) => ({ id: `b-${i}` }));
      },
    });
    const result = await applyWorkspaceOps(
      [
        { op: "createEpic", tempId: "$e", title: "Checkout", description: "d" },
        { op: "createUserStory", epic: "$e", title: "One", description: "d" },
        { op: "createUserStory", epic: "$e", title: "Two", description: "d" },
        { op: "updateEpic", epic: "Billing", description: "n" },
        { op: "createFlow", name: "F", ops: flowOps as never },
      ],
      deps,
    );
    expect(result.failed).toBe(0);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual([
      { op: "createEpic", tempId: "$e", title: "Checkout", description: "d" },
      { op: "createUserStory", tempId: undefined, epic: "$e", title: "One", description: "d" },
      { op: "createUserStory", tempId: undefined, epic: "$e", title: "Two", description: "d" },
      { op: "updateEpic", epic: E1, title: undefined, description: "n" },
    ]);
    expect(result.items.map((item) => item.id)).toEqual(["b-0", "b-1", "b-2", "b-3", "flow-1"]);
    expect(calls.log).toContain("createFlow:F");
    expect(calls.log.some((entry) => entry.startsWith("createEpic"))).toBe(false);
  });

  it("marks the whole run failed when the batch is rejected, and skips later dependents", async () => {
    const { deps } = fakeDeps({
      async board() {
        throw new Error("Item 2: epic not found");
      },
    });
    const result = await applyWorkspaceOps(
      [
        { op: "createEpic", tempId: "$e", title: "A", description: "d" },
        { op: "createUserStory", epic: "$e", title: "B", description: "d" },
        { op: "createFlow", name: "F", ops: flowOps as never },
        { op: "createUserStory", epic: "$e", title: "C", description: "d" },
      ],
      deps,
    );
    expect(result.items.map((item) => item.status)).toEqual([
      "failed",
      "failed",
      "done",
      "skipped",
    ]);
    expect(result.items[0]?.error).toBe("Item 2: epic not found");
  });

  it("fails a story with an unknown epic without sending it", async () => {
    const batches: unknown[][] = [];
    const { deps } = fakeDeps({
      async board(items) {
        batches.push(items);
        return items.map((_, i) => ({ id: `b-${i}` }));
      },
    });
    const result = await applyWorkspaceOps(
      [
        { op: "createUserStory", epic: "Nope", title: "X", description: "d" },
        { op: "createUserStory", epic: "Billing", title: "Y", description: "d" },
      ],
      deps,
    );
    expect(result.items.map((item) => item.status)).toEqual(["failed", "done"]);
    expect(batches[0]).toHaveLength(1);
  });
});

describe("workspace op helpers", () => {
  it("recognises workspace ops only", () => {
    expect(isWorkspaceOp({ op: "createEpic" })).toBe(true);
    expect(isWorkspaceOp({ op: "addNode" })).toBe(false);
    expect(isWorkspaceOp(null)).toBe(false);
  });

  it("describes a batch for the approval list", () => {
    const lines = describeWorkspaceOps([
      { op: "createEpic", tempId: "$e", title: "Checkout", description: "d" },
      { op: "createUserStory", epic: "$e", title: "Pay", description: "d" },
      { op: "createFlow", name: "Pay flow", ops: flowOps as never },
      {
        op: "updateEpic",
        epic: "11111111-1111-4111-8111-111111111111",
        label: "Billing",
        description: "n",
      },
    ]);
    expect(lines).toEqual([
      { kind: "add", subject: "Epic · Checkout", detail: "1 story" },
      { kind: "add", subject: "User story · Pay" },
      { kind: "add", subject: "Flow · Pay flow", detail: "2 steps" },
      { kind: "change", subject: "Epic · Billing", detail: "notes" },
    ]);
  });
});

import { describe, expect, it } from "vitest";
import {
  DRAFT_COMPACT_STEPS,
  applyPartialOps,
  canTransitionOpBatch,
  filterBatchOps,
  isBusyOpBatchStatus,
  mergeDocDiffs,
  planDraftStep,
} from "../src/features/ai/opBatchApplier";
import type { AiOpBatch, AiOpBatchStatus } from "../src/types/ai.types";
import { createEmptyErdDocument } from "../src/utils/erd/erdSerialization";

const add = (name: string) => ({ op: "addEntity", name });

describe("planDraftStep", () => {
  it("applies only the new suffix when the ops grew", () => {
    const a = add("a");
    const b = add("b");
    const c = add("c");
    expect(planDraftStep([a, b], [a, b, c], 0)).toEqual({ mode: "suffix", from: 2 });
  });

  it("falls back to a full reapply when a prefix op changed or shrank", () => {
    const a = add("a");
    expect(planDraftStep([a], [add("a"), add("b")], 0)).toEqual({ mode: "full" });
    expect(planDraftStep([a, add("b")], [a], 0)).toEqual({ mode: "full" });
    expect(planDraftStep([a], [a], 0)).toEqual({ mode: "full" });
    expect(planDraftStep([], [a], 0)).toEqual({ mode: "full" });
  });

  it("falls back when a new op references a temp id", () => {
    const a = add("a");
    const ref = { op: "addField", entity: "$a", field: { name: "id", type: "uuid" } };
    expect(planDraftStep([a], [a, ref], 0)).toEqual({ mode: "full" });
  });

  it("compacts after enough incremental steps", () => {
    const a = add("a");
    expect(planDraftStep([a], [a, add("b")], DRAFT_COMPACT_STEPS)).toEqual({ mode: "full" });
  });
});

describe("mergeDocDiffs", () => {
  it("accumulates adds and changes and cancels add-then-remove", () => {
    const merged = mergeDocDiffs(
      { added: ["a"], changed: ["x"], removed: [] },
      { added: ["b"], changed: ["a", "y"], removed: ["a"] },
    );
    expect(merged.added.sort()).toEqual(["b"]);
    expect(merged.changed.sort()).toEqual(["x", "y"]);
    expect(merged.removed).toEqual([]);
  });

  it("keeps removals of pre-existing ids and drops their change marks", () => {
    const merged = mergeDocDiffs(
      { added: [], changed: ["x"], removed: [] },
      { added: [], changed: [], removed: ["x"] },
    );
    expect(merged).toEqual({ added: [], changed: [], removed: ["x"] });
  });
});

describe("applyPartialOps suffix application", () => {
  it("builds the same document incrementally as in one pass", async () => {
    const base = createEmptyErdDocument("na", "Shop");
    const ops = [add("users"), add("orders"), add("items")];
    const full = await applyPartialOps("data_model", base, ops);
    const ids = { next: 0 };
    const first = await applyPartialOps("data_model", base, ops.slice(0, 2), ids);
    const second = await applyPartialOps("data_model", first!.document, ops.slice(2), ids);
    const names = (doc: unknown) =>
      (doc as { entities: { name: string }[] }).entities.map((e) => e.name).sort();
    expect(names(second!.document)).toEqual(names(full!.document));
    const entityIds = (second!.document as { entities: { id: string }[] }).entities.map(
      (e) => e.id,
    );
    expect(new Set(entityIds).size).toBe(3);
    const merged = mergeDocDiffs(first!.diff, second!.diff);
    expect(merged.added).toHaveLength(3);
  });

  it("drops invalid ops instead of failing the draft", async () => {
    const base = createEmptyErdDocument("na", "Shop");
    const result = await applyPartialOps("data_model", base, [
      add("users"),
      { op: "removeEntity", entity: "ghost" },
    ]);
    expect(result?.diff.added).toHaveLength(1);
  });
});

describe("filterBatchOps", () => {
  const batch = { ops: [add("a"), add("b"), add("c")] } as unknown as AiOpBatch;

  it("returns the same batch when nothing is excluded", () => {
    expect(filterBatchOps(batch, new Set())).toBe(batch);
  });

  it("drops the excluded op indexes", () => {
    expect(filterBatchOps(batch, new Set([1])).ops).toEqual([add("a"), add("c")]);
  });
});

describe("status handling", () => {
  const matrix: Record<AiOpBatchStatus, AiOpBatchStatus[]> = {
    proposed: ["applying", "applied", "rejected", "conflict", "discarded"],
    applying: ["proposed", "applied", "rejected", "conflict", "discarded"],
    conflict: ["applying", "applied", "discarded"],
    applied: ["saved", "discarded", "rejected", "conflict"],
    saved: [],
    rejected: [],
    discarded: [],
  };

  it("matches the server transition matrix", () => {
    const all = Object.keys(matrix) as AiOpBatchStatus[];
    for (const from of all) {
      for (const to of all) {
        expect(canTransitionOpBatch(from, to), `${from} -> ${to}`).toBe(matrix[from].includes(to));
      }
    }
  });

  it("does not throw on unknown statuses and recognises applying", () => {
    expect(canTransitionOpBatch("applying", "saved")).toBe(false);
    expect(canTransitionOpBatch("nonsense" as AiOpBatchStatus, "saved")).toBe(false);
    expect(isBusyOpBatchStatus("applying")).toBe(true);
    expect(isBusyOpBatchStatus("applied")).toBe(false);
  });
});

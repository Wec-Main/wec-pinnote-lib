import { beforeEach, describe, expect, it, vi } from "vitest";
import { chooseDockAction, describeLiveOp } from "../src/features/ai/components/aiDockLogic";
import { describeOpBatch } from "../src/features/ai/components/aiOpChanges";
import { postDraftOnce, resetPostedDrafts } from "../src/features/ai/components/useAiCardActions";
import type { AiOpBatch } from "../src/types/ai.types";
import { blogDocument } from "./erdFixtures";

describe("chooseDockAction", () => {
  it("defaults to ask with no chip pinned, regardless of document state", () => {
    expect(chooseDockAction("data_model", { empty: true, selectionCount: 0 })).toEqual({
      actionKey: "erd.ask",
      useSelection: false,
    });
    expect(chooseDockAction("data_model", { empty: false, selectionCount: 0 })).toEqual({
      actionKey: "erd.ask",
      useSelection: false,
    });
    expect(chooseDockAction("flow", { empty: false, selectionCount: 2 })).toEqual({
      actionKey: "flow.ask",
      useSelection: true,
    });
  });

  it("lets chips choose explicitly", () => {
    const doc = { empty: false, selectionCount: 1 };
    expect(chooseDockAction("data_model", doc, "generate").actionKey).toBe("erd.generate");
    expect(chooseDockAction("data_model", doc, "review")).toEqual({
      actionKey: "erd.review",
      useSelection: true,
    });
    expect(chooseDockAction("flow", doc, "explain_doc")).toEqual({
      actionKey: "flow.explain",
      useSelection: false,
    });
    expect(chooseDockAction("flow", doc, "explain")).toEqual({
      actionKey: "flow.explain",
      useSelection: true,
    });
    expect(
      chooseDockAction("data_model", { empty: true, selectionCount: 0 }, "explain").actionKey,
    ).toBe("erd.explain");
  });
});

describe("describeOpBatch", () => {
  it("lists entity and field changes with before and after values", () => {
    const doc = blogDocument();
    const entity = doc.entities[0]!;
    const field = entity.fields[0]!;
    const lines = describeOpBatch(
      {
        targetKind: "data_model",
        ops: [
          { op: "addEntity", tempId: "$t", name: "tags", fields: [{ name: "id", type: "uuid" }] },
          { op: "addField", entity: "$t", field: { name: "label", type: "varchar", length: 40 } },
          { op: "updateField", entity: entity.name, field: field.name, patch: { type: "bigint" } },
          { op: "removeEntity", entity: entity.id },
        ],
      } as unknown as AiOpBatch,
      doc,
    );
    expect(lines).toEqual([
      { kind: "add", subject: "tags", detail: "1 field", opIndex: 0 },
      { kind: "add", subject: "tags.label", detail: "varchar(40)", opIndex: 1 },
      {
        kind: "change",
        subject: `${entity.name}.${field.name}`,
        detail: "type",
        before: field.type,
        after: "bigint",
        opIndex: 2,
      },
      { kind: "remove", subject: entity.name, detail: "entity", opIndex: 3 },
    ]);
  });
});

describe("postDraftOnce", () => {
  beforeEach(() => resetPostedDrafts());

  it("creates the comment once and only retries the status update", async () => {
    const create = vi.fn(async () => ({ id: "c1" }));
    const mark = vi
      .fn<(id: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);
    const draft = { aiCommentDraftId: "d1", postedCommentId: null };

    await expect(postDraftOnce(draft, create, mark)).rejects.toThrow("offline");
    await expect(postDraftOnce(draft, create, mark)).resolves.toBe("c1");
    expect(create).toHaveBeenCalledTimes(1);
    expect(mark.mock.calls).toEqual([["c1"], ["c1"]]);
  });

  it("reuses a server-side posted comment id", async () => {
    const create = vi.fn(async () => ({ id: "new" }));
    const mark = vi.fn(async () => undefined);
    await postDraftOnce({ aiCommentDraftId: "d2", postedCommentId: "c9" }, create, mark);
    expect(create).not.toHaveBeenCalled();
    expect(mark).toHaveBeenCalledWith("c9");
  });
});

describe("describeLiveOp", () => {
  it("names what the AI is drawing right now", () => {
    expect(describeLiveOp({ op: "addNode", label: "Validate MFA" })).toBe(
      'Adding step "Validate MFA"',
    );
    expect(describeLiveOp({ op: "addEdge", source: "$verify_mfa", target: "Done" })).toBe(
      "Connecting verify mfa → Done",
    );
    expect(describeLiveOp({ op: "addEntity", name: "orders" })).toBe('Adding table "orders"');
    expect(describeLiveOp({ op: "addRelationship", source: "users", target: "$orders" })).toBe(
      "Linking users → orders",
    );
    expect(describeLiveOp({ op: "autoLayout" })).toBe("Arranging the layout");
    expect(describeLiveOp({ op: "renameField" })).toBe("Updating the model");
    expect(describeLiveOp(null)).toBeNull();
    expect(describeLiveOp({ op: "mystery" })).toBeNull();
  });
});

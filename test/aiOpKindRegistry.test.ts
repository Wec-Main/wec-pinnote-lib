import { describe, expect, it } from "vitest";
import { getOpKind, listOpKinds, registerOpKind, type OpKindPlugin } from "../src/ai/ops/registry";
import { createEmptyErdDocument } from "../src/utils/erd/erdSerialization";
import type { ErdDocumentJSON } from "../src/types/dataModel.types";
import type { FlowJSON } from "../src/types/flowchart.types";

describe("OpKindPlugin registry", () => {
  it("registers data_model and flow as built-ins", () => {
    expect(listOpKinds().map((plugin) => plugin.kind).sort()).toEqual(["data_model", "flow"]);
  });

  it("does not register workspace (it has a fundamentally different apply shape)", () => {
    expect(getOpKind("workspace")).toBeUndefined();
  });

  it("applies erd ops through the registry the same way the direct function would", async () => {
    const plugin = getOpKind("data_model")!;
    const base = createEmptyErdDocument("na", "Shop");
    const result = await plugin.apply(base, [{ op: "addEntity", name: "users" }]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const doc = result.document as ErdDocumentJSON;
      expect(doc.entities.map((entity) => entity.name)).toContain("users");
    }
  });

  it("applies flow ops through the registry", async () => {
    const plugin = getOpKind("flow")!;
    const base: FlowJSON = { version: 1, nodes: [], edges: [], meta: { name: "", edgeType: "step" } };
    const result = await plugin.apply(base, [
      { op: "addNode", type: "process", label: "Step 1" },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const doc = result.document as FlowJSON;
      expect(doc.nodes.map((node) => node.data.label)).toContain("Step 1");
    }
  });

  it("describes erd ops via the registry", () => {
    const plugin = getOpKind("data_model")!;
    const lines = plugin.describe([{ op: "addEntity", name: "orders" }], null);
    expect(lines).toEqual([expect.objectContaining({ kind: "add", subject: "orders" })]);
  });

  it("clears content while keeping document identity", () => {
    const plugin = getOpKind("data_model")!;
    const doc = createEmptyErdDocument("na", "Shop");
    const withEntity: ErdDocumentJSON = {
      ...doc,
      entities: [
        {
          id: "e1",
          name: "users",
          fields: [],
          schema: undefined,
          comment: undefined,
        } as unknown as ErdDocumentJSON["entities"][number],
      ],
    };
    const cleared = plugin.clearContent(withEntity) as ErdDocumentJSON;
    expect(cleared.entities).toEqual([]);
    expect(cleared.meta?.name).toBe(doc.meta?.name);
  });

  it("carries the dock chips used by AiEditorDock for each kind", () => {
    expect(getOpKind("data_model")?.dockChips.map((chip) => chip.id)).toContain("review");
    expect(getOpKind("flow")?.dockChips.map((chip) => chip.id)).toContain("explain_doc");
  });

  it("lets a caller register an additional kind without disturbing the built-ins", () => {
    const before = getOpKind("flow");
    const stub: OpKindPlugin<FlowJSON> = {
      kind: "flow",
      specs: {},
      jsonSchema: {},
      parse: () => ({ ok: true, ops: [] }),
      apply: async (doc) => ({
        ok: true,
        document: doc,
        idMap: {},
        diff: { added: [], changed: [], removed: [] },
        warnings: [],
      }),
      describe: () => [],
      summarize: () => ({ name: null, nodeCount: 0, edgeCount: 0, nodes: [], edges: [] }),
      clearContent: (doc) => doc,
      dockChips: [],
    };
    registerOpKind(stub);
    expect(getOpKind("flow")).toBe(stub);
    registerOpKind(before!);
    expect(getOpKind("flow")).toBe(before);
  });
});

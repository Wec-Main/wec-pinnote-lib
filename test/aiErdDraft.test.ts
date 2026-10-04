import { describe, expect, it } from "vitest";
import {
  CoalescingRunner,
  advanceDraftSession,
  extendsApplied,
  promoteDraftSession,
  startDraftSession,
  type DraftSession,
} from "../src/features/ai/opBatchApplier";
import {
  applyErdDraftOps,
  applyErdOps,
  finishErdDraft,
  startErdDraft,
  type ErdDraft,
} from "../src/features/ai/ops/applyErdOps";
import type { ErdOp } from "../src/features/ai/ops";
import type { ErdDocumentJSON } from "../src/types/dataModel.types";
import { createEmptyErdDocument } from "../src/utils/erd/erdSerialization";
import { blogDocument } from "./erdFixtures";

function seqIds() {
  let n = 0;
  return (prefix: string) => `${prefix}_${++n}`;
}

const GENERATE: ErdOp[] = [
  { op: "setModelName", name: "Shop" },
  { op: "addEnum", tempId: "$status", name: "order_status", values: ["new", "paid", "shipped"] },
  {
    op: "addEntity",
    tempId: "$customers",
    name: "customers",
    fields: [
      { tempId: "$cid", name: "id", type: "uuid", primaryKey: true },
      { name: "email", type: "varchar", length: 255, unique: true, nullable: false },
    ],
  },
  {
    op: "addEntity",
    tempId: "$orders",
    name: "orders",
    fields: [
      { tempId: "$oid", name: "id", type: "uuid", primaryKey: true },
      { tempId: "$ocust", name: "customer_id", type: "uuid", nullable: false },
      { name: "status", type: "text", enum: "$status" },
    ],
  },
  {
    op: "addRelationship",
    tempId: "$r1",
    source: "$customers",
    target: "$orders",
    sourceField: "$cid",
    targetField: "$ocust",
    cardinality: "one-to-many",
    onDelete: "cascade",
  },
  {
    op: "addEntity",
    tempId: "$products",
    name: "products",
    fields: [
      { tempId: "$pid", name: "id", type: "uuid", primaryKey: true },
      { name: "title", type: "varchar", length: 120 },
    ],
  },
  {
    op: "addEntity",
    tempId: "$items",
    name: "order_items",
    fields: [
      { tempId: "$iid", name: "id", type: "uuid", primaryKey: true },
      { tempId: "$iorder", name: "order_id", type: "uuid" },
      { tempId: "$iproduct", name: "product_id", type: "uuid" },
    ],
  },
  {
    op: "addRelationship",
    source: "$orders",
    target: "$items",
    targetField: "$iorder",
    cardinality: "one-to-many",
  },
  {
    op: "addRelationship",
    source: "$products",
    target: "$items",
    targetField: "$iproduct",
    cardinality: "one-to-many",
  },
  { op: "addField", entity: "$customers", tempId: "$cname", field: { name: "name", type: "text" } },
  { op: "updateEntity", entity: "$orders", patch: { comment: "Placed orders" } },
  { op: "addIndex", entity: "$items", tempId: "$idx", fields: ["$iorder", "$iproduct"] },
  { op: "addNote", tempId: "$n", text: "Checkout flow", near: "$orders" },
  { op: "setModelDescription", description: "A small shop" },
];

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

function draftAll(doc: ErdDocumentJSON, ops: readonly ErdOp[], size: number) {
  const createId = seqIds();
  let draft: ErdDraft = startErdDraft(doc);
  const steps: ErdDraft[] = [];
  for (const part of chunks(ops, size)) {
    const step = applyErdDraftOps(draft, part, { createId });
    if (!step.ok) throw new Error(JSON.stringify(step.errors));
    draft = step.draft;
    steps.push(draft);
  }
  return { draft, steps };
}

function full(doc: ErdDocumentJSON, ops: readonly ErdOp[]) {
  const result = applyErdOps(doc, ops, { createId: seqIds() });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result;
}

describe("incremental ERD drafting", () => {
  it.each([1, 2, 3, 5, GENERATE.length])(
    "matches a full apply of an erd.generate stream on an empty model (step size %i)",
    (size) => {
      const empty = createEmptyErdDocument("postgres");
      const expected = full(empty, GENERATE);
      const { draft } = draftAll(empty, GENERATE, size);
      const finished = finishErdDraft(draft);
      if (!finished.ok) throw new Error(JSON.stringify(finished.errors));
      expect(finished.document).toEqual(expected.document);
      expect(finished.idMap).toEqual(expected.idMap);
      expect(new Set(finished.diff.added)).toEqual(new Set(expected.diff.added));
      expect(finished.diff.changed).toEqual(expected.diff.changed);
    },
  );

  it.each([1, 4])(
    "matches a full apply when extending an existing model (step size %i)",
    (size) => {
      const base = blogDocument();
      const ops = GENERATE.filter((op) => op.op !== "setModelName");
      const expected = full(base, ops);
      const { draft } = draftAll(base, ops, size);
      const finished = finishErdDraft(draft);
      if (!finished.ok) throw new Error(JSON.stringify(finished.errors));
      expect(finished.document).toEqual(expected.document);
      expect(finished.idMap).toEqual(expected.idMap);
    },
  );

  it("resolves temp ids declared in earlier steps", () => {
    const empty = createEmptyErdDocument("postgres");
    const { draft, steps } = draftAll(empty, GENERATE, 1);
    const relationship = steps[4]!.doc.relationships[0]!;
    const ids = draft.temps.toIdMap();
    expect(relationship).toMatchObject({
      sourceEntityId: ids.$customers,
      targetEntityId: ids.$orders,
      sourceFieldId: ids.$cid,
      targetFieldId: ids.$ocust,
    });
    const status = draft.doc.entities
      .find((entity) => entity.id === ids.$orders)!
      .fields.find((field) => field.name === "status")!;
    expect(status.enumId).toBe(ids.$status);
  });

  it("keeps unchanged entities and relationships by reference between steps", () => {
    const base = blogDocument();
    const { steps } = draftAll(base, GENERATE, 1);
    const first = steps[2]!;
    const later = steps[8]!;
    const customers = first.doc.entities.find((entity) => entity.name === "customers")!;
    expect(later.doc.entities.find((entity) => entity.name === "customers")).toBe(customers);
    for (const entity of base.entities) {
      expect(later.doc.entities.find((item) => item.id === entity.id)).toBe(entity);
    }
    for (const rel of base.relationships) {
      expect(later.doc.relationships.find((item) => item.id === rel.id)).toBe(rel);
    }
    const afterRel = steps[4]!.doc.relationships.at(-1)!;
    expect(steps[7]!.doc.relationships.find((rel) => rel.id === afterRel.id)).toBe(afterRel);
  });

  it("never mutates the document it started from or earlier steps", () => {
    const empty = createEmptyErdDocument("postgres");
    const snapshot = JSON.stringify(empty);
    const { steps } = draftAll(empty, GENERATE, 2);
    const frozen = steps.map((step) => JSON.stringify(step.doc));
    finishErdDraft(steps.at(-1)!);
    expect(JSON.stringify(empty)).toBe(snapshot);
    expect(steps.map((step) => JSON.stringify(step.doc))).toEqual(frozen);
  });

  it("rejects a step whose op fails without touching the draft", () => {
    const draft = startErdDraft(createEmptyErdDocument("postgres"));
    const step = applyErdDraftOps(draft, [{ op: "removeEntity", entity: "$missing" }]);
    expect(step.ok).toBe(false);
    expect(draft.doc.entities).toEqual([]);
  });
});

describe("draft sessions", () => {
  async function session(doc: ErdDocumentJSON): Promise<DraftSession> {
    const started = await startDraftSession("data_model", doc);
    if (!started) throw new Error("no draft kit");
    return started;
  }

  async function advance(current: DraftSession, ops: readonly unknown[]): Promise<DraftSession> {
    const next = await advanceDraftSession(current, ops);
    if (!next || next === "rebuild") throw new Error(`unexpected ${String(next)}`);
    return next;
  }

  it("applies only new ops and asks for a rebuild when an earlier op changes", async () => {
    let current = await session(createEmptyErdDocument("postgres"));
    current = await advance(current, GENERATE.slice(0, 3));
    const before = current.document;
    current = await advance(current, GENERATE.slice(0, 5));
    expect(current.applied).toHaveLength(5);
    expect(current.document).not.toBe(before);
    const changed = [...GENERATE.slice(0, 2), { ...GENERATE[2]!, name: "clients" }];
    expect(await advanceDraftSession(current, changed)).toBe("rebuild");
  });

  it("skips failing new ops and reports them", async () => {
    let current = await session(createEmptyErdDocument("postgres"));
    current = await advance(current, [
      GENERATE[2]!,
      { op: "removeEntity", entity: "nope" },
      GENERATE[1]!,
    ]);
    expect(current.document.entities).toHaveLength(1);
    expect(current.skipped).toEqual([expect.stringMatching(/^#1 removeEntity/)]);
  });

  it("promotes a draft whose final batch extends the drafted ops", async () => {
    const empty = createEmptyErdDocument("postgres");
    let current = await session(empty);
    current = await advance(current, GENERATE.slice(0, 6));
    const promoted = await promoteDraftSession(
      current,
      GENERATE.map((op) => ({ ...op })),
    );
    if (!promoted?.ok) throw new Error("not promoted");
    const names = (promoted.document as ErdDocumentJSON).entities.map((entity) => entity.name);
    expect(names).toEqual(["customers", "orders", "products", "order_items"]);
    expect((promoted.document as ErdDocumentJSON).notes).toHaveLength(1);
    expect(promoted.skipped).toEqual([]);
  });

  it("refuses to promote when the final ops differ from the drafted ones", async () => {
    let current = await session(createEmptyErdDocument("postgres"));
    current = await advance(current, GENERATE.slice(0, 4));
    const repaired = [GENERATE[0]!, GENERATE[2]!, GENERATE[1]!, GENERATE[3]!];
    expect(await promoteDraftSession(current, repaired)).toBeNull();
    expect(await promoteDraftSession(current, GENERATE.slice(0, 3))).toBeNull();
  });

  it("compares drafted ops structurally", () => {
    const ops = GENERATE.slice(0, 3);
    expect(
      extendsApplied(
        ops,
        ops.map((op) => JSON.parse(JSON.stringify(op))),
      ),
    ).toBe(true);
    expect(extendsApplied(ops, ops.slice(0, 2))).toBe(false);
  });
});

describe("CoalescingRunner", () => {
  it("runs one step at a time and only the latest pending value", async () => {
    const seen: number[] = [];
    const gates: (() => void)[] = [];
    const runner = new CoalescingRunner<number>(
      (value) =>
        new Promise((resolve) => {
          seen.push(value);
          gates.push(() => resolve(true));
        }),
    );
    const first = runner.submit(1);
    const second = runner.submit(2);
    const third = runner.submit(3);
    expect(seen).toEqual([1]);
    gates.shift()!();
    await first;
    await Promise.resolve();
    expect(seen).toEqual([1, 3]);
    gates.shift()!();
    expect(await second).toBe(true);
    expect(await third).toBe(true);
    expect(runner.busy).toBe(false);
  });

  it("clear() drops the pending value", async () => {
    const seen: number[] = [];
    let release!: () => void;
    const runner = new CoalescingRunner<number>(
      (value) =>
        new Promise((resolve) => {
          seen.push(value);
          release = () => resolve(true);
        }),
    );
    const first = runner.submit(1);
    const dropped = runner.submit(2);
    runner.clear();
    expect(await dropped).toBe(false);
    release();
    expect(await first).toBe(true);
    expect(seen).toEqual([1]);
  });
});

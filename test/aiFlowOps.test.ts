import { describe, expect, it } from "vitest";
import { AI_FLOW_LIMITS, diffFlow, parseFlowOps, summarizeFlow, type FlowOp } from "../src/ai/ops";
import { applyFlowOps } from "../src/ai/ops/applyFlowOps";
import type { FlowJSON, FlowNode } from "../src/types/flowchart.types";
import { getNodeRect, rectsIntersect } from "../src/utils/flowchart/geometry";
import { NodeTypeRegistry } from "../src/utils/flowchart/nodeTypes";
import { parseFlow } from "../src/utils/flowchart/serialization";

const registry = new NodeTypeRegistry();

function seqIds() {
  let n = 0;
  return (prefix: string) => `${prefix}_${++n}`;
}

function node(id: string, type: string, label: string, x = 0, y = 0): FlowNode {
  return { id, type, position: { x, y }, data: { label, description: "", properties: {} } };
}

function baseFlow(): FlowJSON {
  return {
    version: 1,
    nodes: [
      node("start", "start", "Start", 0, 0),
      node("check", "decision", "Paid?", 300, 0),
      node("done", "end", "Done", 600, 0),
    ],
    edges: [
      {
        id: "e1",
        source: "start",
        target: "check",
        sourceHandle: "out-right",
        targetHandle: "in-left",
      },
      {
        id: "e2",
        source: "check",
        target: "done",
        sourceHandle: "yes",
        targetHandle: "in-left",
        label: "Yes",
      },
    ],
    meta: { name: "Checkout" },
  };
}

function ok(ops: FlowOp[], doc: FlowJSON = baseFlow()) {
  const result = applyFlowOps(doc, ops, { createId: seqIds() });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result;
}

function errorsOf(ops: FlowOp[], doc: FlowJSON = baseFlow()) {
  const result = applyFlowOps(doc, ops, { createId: seqIds() });
  if (result.ok) throw new Error("expected failure");
  return result.errors;
}

const byId = (doc: FlowJSON, id: string | undefined) => doc.nodes.find((n) => n.id === id)!;

describe("applyFlowOps: nodes", () => {
  it("adds a node shaped like FlowEngine's", () => {
    const { document, idMap } = ok([
      { op: "addNode", tempId: "$p", type: "process", label: "Charge card" },
    ]);
    const added = byId(document, idMap.$p);
    expect(added.id).toMatch(/^process_/);
    expect(added.data).toEqual({ label: "Charge card", description: "", properties: {} });
    expect(added.width).toBeUndefined();
  });

  it("rejects unknown node types and empty labels", () => {
    const errors = errorsOf([
      { op: "addNode", type: "wizard", label: "x" },
      { op: "addNode", type: "process", label: "  " },
    ]);
    expect(errors.map((e) => [e.index, e.code])).toEqual([
      [0, "invalid_value"],
      [1, "invalid_value"],
    ]);
  });

  it("places nodes relative to near, then the last added node, without overlaps", () => {
    const { document, idMap } = ok([
      {
        op: "addNode",
        tempId: "$a",
        type: "process",
        label: "A",
        near: "check",
        placement: "below",
      },
      { op: "addNode", tempId: "$b", type: "process", label: "B" },
      { op: "addNode", tempId: "$c", type: "process", label: "C", near: "$a", placement: "right" },
    ]);
    const check = getNodeRect(byId(document, "check"), registry);
    const a = getNodeRect(byId(document, idMap.$a), registry);
    const b = getNodeRect(byId(document, idMap.$b), registry);
    expect(a.y).toBeGreaterThan(check.y + check.height);
    expect(b.x).toBeGreaterThan(a.x + a.width);
    const rects = document.nodes.map((n) => getNodeRect(n, registry));
    rects.forEach((r, i) =>
      rects.forEach((o, j) => {
        if (i !== j) expect(rectsIntersect(r, o)).toBe(false);
      }),
    );
  });

  it("places the first new node right of the right-most node", () => {
    const { document, idMap } = ok([{ op: "addNode", tempId: "$x", type: "process", label: "X" }]);
    const done = getNodeRect(byId(document, "done"), registry);
    expect(byId(document, idMap.$x).position.x).toBeGreaterThan(done.x + done.width);
  });

  it("updates a node, merging properties and removing null keys", () => {
    const doc = baseFlow();
    doc.nodes[0]!.data.properties = { a: 1, b: "x" };
    const { document } = ok(
      [
        {
          op: "updateNode",
          node: "Start",
          patch: { label: "Begin", description: "d", properties: { a: null, c: true } },
        },
      ],
      doc,
    );
    expect(byId(document, "start").data).toMatchObject({
      label: "Begin",
      description: "d",
      properties: { b: "x", c: true },
    });
  });

  it("refuses a type change that breaks existing connections", () => {
    expect(errorsOf([{ op: "updateNode", node: "done", patch: { type: "start" } }])[0]?.code).toBe(
      "invalid_connection",
    );
  });

  it("removes a node with its edges", () => {
    const { document, diff } = ok([{ op: "removeNode", node: "check" }]);
    expect(document.edges).toEqual([]);
    expect(diff.removed).toEqual(expect.arrayContaining(["check", "e1", "e2"]));
  });
});

describe("applyFlowOps: edges", () => {
  it("infers yes/no on edges leaving a decision and labels them by default", () => {
    const missing = ok([
      { op: "addNode", tempId: "$r", type: "process", label: "Retry" },
      { op: "addEdge", tempId: "$e", source: "check", target: "$r" },
    ]);
    expect(missing.document.edges.find((e) => e.id === missing.idMap.$e)).toMatchObject({
      sourceHandle: "no",
      label: "No",
    });
    const wrong = ok([
      { op: "addNode", tempId: "$r", type: "process", label: "Retry" },
      { op: "addEdge", tempId: "$e", source: "check", target: "$r", sourceHandle: "out-top" },
    ]);
    expect(wrong.document.edges.find((e) => e.id === wrong.idMap.$e)?.sourceHandle).toBe("no");
    const empty: FlowJSON = { ...baseFlow(), edges: [] };
    const labelled = ok(
      [
        { op: "addNode", tempId: "$r", type: "process", label: "Retry" },
        { op: "addEdge", tempId: "$e", source: "check", target: "$r", label: "Invalid" },
      ],
      empty,
    );
    expect(labelled.document.edges.find((e) => e.id === labelled.idMap.$e)?.sourceHandle).toBe(
      "no",
    );
    const { document, idMap } = ok([
      { op: "addNode", tempId: "$r", type: "process", label: "Retry" },
      { op: "addEdge", tempId: "$no", source: "check", target: "$r", sourceHandle: "no" },
    ]);
    const edge = document.edges.find((e) => e.id === idMap.$no)!;
    expect(edge).toMatchObject({ source: "check", sourceHandle: "no", label: "No" });
    expect(edge.targetHandle).toMatch(/^in-/);
  });

  it("skips impossible edges with a warning instead of failing the batch", () => {
    const result = ok([
      { op: "addEdge", source: "done", target: "start" },
      { op: "addEdge", source: "start", target: "start" },
      {
        op: "addEdge",
        source: "start",
        target: "check",
        sourceHandle: "out-right",
        targetHandle: "in-left",
      },
      { op: "addNode", tempId: "$x", type: "process", label: "Extra" },
    ]);
    expect(result.document.edges).toHaveLength(baseFlow().edges.length);
    expect(result.warnings.filter((w) => w.startsWith("Skipped edge"))).toHaveLength(3);
    expect(
      errorsOf([{ op: "addEdge", tempId: "$e", source: "done", target: "start" }])[0]?.code,
    ).toBe("invalid_connection");
  });

  it("picks facing handles when they are omitted", () => {
    const { document, idMap } = ok([
      {
        op: "addNode",
        tempId: "$p",
        type: "process",
        label: "P",
        near: "start",
        placement: "below",
      },
      { op: "addEdge", tempId: "$e", source: "start", target: "$p" },
    ]);
    const edge = document.edges.find((e) => e.id === idMap.$e)!;
    expect(edge.sourceHandle).toBe("out");
    expect(edge.targetHandle).toBe("in-top");
  });

  it("updates and removes edges by label", () => {
    const updated = ok([
      { op: "updateEdge", edge: "Yes", patch: { label: null, type: "straight", animated: true } },
    ]);
    const edge = updated.document.edges.find((e) => e.id === "e2")!;
    expect(edge.label).toBeUndefined();
    expect(edge).toMatchObject({ type: "straight", animated: true });
    expect(ok([{ op: "removeEdge", edge: "e1" }]).document.edges.map((e) => e.id)).toEqual(["e2"]);
  });

  it("inserts a node on an edge like the editor", () => {
    const { document, idMap } = ok([
      { op: "insertNodeOnEdge", edge: "e2", tempId: "$m", type: "process", label: "Ship" },
    ]);
    const mid = byId(document, idMap.$m);
    expect(document.edges.some((e) => e.id === "e2")).toBe(false);
    const into = document.edges.find((e) => e.target === mid.id)!;
    const out = document.edges.find((e) => e.source === mid.id)!;
    expect(into).toMatchObject({ source: "check", sourceHandle: "yes", label: "Yes" });
    expect(out).toMatchObject({ target: "done", targetHandle: "in-left" });
  });

  it("inserting a decision uses its yes handle for the outgoing edge", () => {
    const { document, idMap } = ok([
      { op: "insertNodeOnEdge", edge: "e1", tempId: "$d", type: "decision", label: "Again?" },
    ]);
    expect(document.edges.find((e) => e.source === idMap.$d)?.sourceHandle).toBe("yes");
  });

  it("refuses to insert a node that cannot carry the connection", () => {
    expect(
      errorsOf([{ op: "insertNodeOnEdge", edge: "e1", type: "end", label: "Stop" }])[0]?.code,
    ).toBe("invalid_connection");
  });
});

describe("applyFlowOps: document ops, layout, rules", () => {
  it("sets name and notes", () => {
    const { document, diff } = ok([
      { op: "setFlowName", name: "Checkout v2" },
      { op: "setFlowNotes", notes: "Draft" },
    ]);
    expect(document.meta).toMatchObject({ name: "Checkout v2", notes: "Draft" });
    expect(diff.changed).toEqual(["document"]);
    expect(ok([{ op: "setFlowNotes", notes: "" }]).document.meta?.notes).toBeUndefined();
  });

  it("lays nodes out in layers following the edges", () => {
    const { document } = ok([{ op: "autoLayout", direction: "TB" }]);
    const ys = ["start", "check", "done"].map((id) => byId(document, id).position.y);
    expect(ys[0]).toBeLessThan(ys[1]!);
    expect(ys[1]).toBeLessThan(ys[2]!);
    const lr = ok([{ op: "autoLayout" }]).document;
    expect(byId(lr, "start").position.x).toBeLessThan(byId(lr, "done").position.x);
  });

  it("saves node descriptions and flow notes from the ops", () => {
    const empty: FlowJSON = { version: 1, nodes: [], edges: [], meta: { name: "Login" } };
    const { document, idMap } = ok(
      [
        { op: "addNode", tempId: "$s", type: "start", label: "Start" },
        {
          op: "addNode",
          tempId: "$f",
          type: "process",
          label: "Enter credentials",
          description: "User types email and password.",
        },
        { op: "addEdge", source: "$s", target: "$f" },
        { op: "setFlowNotes", notes: "Assumes password login only." },
      ],
      empty,
    );
    expect(byId(document, idMap["$f"]!).data.description).toBe("User types email and password.");
    expect(document.meta?.notes).toBe("Assumes password login only.");
  });

  it("lays out a generated flow with a straight main path and stacked branches", () => {
    const empty: FlowJSON = { version: 1, nodes: [], edges: [], meta: { name: "Login" } };
    const { document, idMap } = ok(
      [
        { op: "addNode", tempId: "$s", type: "start", label: "Start" },
        { op: "addNode", tempId: "$f", type: "process", label: "Enter credentials" },
        { op: "addNode", tempId: "$d", type: "decision", label: "Valid?" },
        { op: "addNode", tempId: "$ok", type: "process", label: "Open dashboard" },
        { op: "addNode", tempId: "$err", type: "process", label: "Show error" },
        { op: "addNode", tempId: "$e", type: "end", label: "Done" },
        { op: "addEdge", source: "$s", target: "$f" },
        { op: "addEdge", source: "$f", target: "$d" },
        { op: "addEdge", source: "$d", target: "$ok", sourceHandle: "yes" },
        { op: "addEdge", source: "$d", target: "$err", sourceHandle: "no" },
        { op: "addEdge", source: "$ok", target: "$e" },
      ],
      empty,
    );
    const rect = (temp: string) => getNodeRect(byId(document, idMap[temp]!), registry);
    const centerY = (temp: string) => rect(temp).y + rect(temp).height / 2;
    const centerX = (temp: string) => rect(temp).x + rect(temp).width / 2;
    expect(centerY("$s")).toBe(centerY("$f"));
    expect(centerY("$f")).toBe(centerY("$d"));
    expect(centerX("$s")).toBeLessThan(centerX("$f"));
    expect(centerX("$f")).toBeLessThan(centerX("$d"));
    expect(centerX("$ok")).toBe(centerX("$err"));
    expect(centerY("$ok")).toBeLessThan(centerY("$err"));
    expect(centerY("$ok") + centerY("$err")).toBe(2 * centerY("$d"));
    const rects = document.nodes.map((n) => getNodeRect(n, registry));
    rects.forEach((r, i) =>
      rects.forEach((o, j) => {
        if (i !== j) expect(rectsIntersect(r, o)).toBe(false);
      }),
    );
  });

  it("keeps drawn nodes in place as more streamed ops arrive", () => {
    const empty: FlowJSON = { version: 1, nodes: [], edges: [], meta: { name: "Login" } };
    const ops: FlowOp[] = [
      { op: "addNode", tempId: "$s", type: "start", label: "Start" },
      { op: "addNode", tempId: "$f", type: "process", label: "Enter credentials" },
      { op: "addEdge", source: "$s", target: "$f" },
      { op: "addNode", tempId: "$d", type: "decision", label: "Valid?" },
      { op: "addEdge", source: "$f", target: "$d" },
      { op: "addNode", tempId: "$ok", type: "process", label: "Open dashboard" },
      { op: "addEdge", source: "$d", target: "$ok", sourceHandle: "yes" },
      { op: "addNode", tempId: "$err", type: "process", label: "Show error" },
      { op: "addEdge", source: "$d", target: "$err", sourceHandle: "no" },
    ];
    const at = (count: number) => {
      const { document, idMap } = ok(ops.slice(0, count), empty);
      return (temp: string) => byId(document, idMap[temp]!).position;
    };
    const first = at(1);
    const early = at(5);
    const late = at(ops.length);
    expect(late("$s")).toEqual(first("$s"));
    for (const temp of ["$s", "$f", "$d"]) expect(late(temp)).toEqual(early(temp));
  });

  it("lays a swimlane diagram out with every step inside its own lane", () => {
    const empty: FlowJSON = { version: 1, nodes: [], edges: [], meta: { name: "Login" } };
    const { document, idMap } = ok(
      [
        { op: "addNode", tempId: "$user", type: "swimlane", label: "User" },
        { op: "addNode", tempId: "$app", type: "swimlane", label: "App" },
        { op: "addNode", tempId: "$db", type: "swimlane", label: "Database" },
        { op: "addNode", tempId: "$s", type: "start", label: "Start", lane: "$user" },
        { op: "addNode", tempId: "$f", type: "process", label: "Enter credentials", lane: "User" },
        { op: "addNode", tempId: "$v", type: "process", label: "Validate", lane: "$app" },
        { op: "addNode", tempId: "$q", type: "process", label: "Look up user", lane: "$db" },
        { op: "addNode", tempId: "$ok", type: "decision", label: "Valid?", lane: "$app" },
        { op: "addNode", tempId: "$e", type: "end", label: "Done", lane: "$user" },
        { op: "addEdge", source: "$s", target: "$f" },
        { op: "addEdge", source: "$f", target: "$v" },
        { op: "addEdge", source: "$v", target: "$q" },
        { op: "addEdge", source: "$q", target: "$ok" },
        { op: "addEdge", source: "$ok", target: "$e", sourceHandle: "yes" },
      ],
      empty,
    );
    const rect = (temp: string) => getNodeRect(byId(document, idMap[temp]!), registry);
    const inside = (temp: string, lane: string) => {
      const r = rect(temp);
      const l = rect(lane);
      return (
        r.x >= l.x &&
        r.y >= l.y &&
        r.x + r.width <= l.x + l.width &&
        r.y + r.height <= l.y + l.height
      );
    };
    expect(inside("$s", "$user")).toBe(true);
    expect(inside("$f", "$user")).toBe(true);
    expect(inside("$e", "$user")).toBe(true);
    expect(inside("$v", "$app")).toBe(true);
    expect(inside("$ok", "$app")).toBe(true);
    expect(inside("$q", "$db")).toBe(true);
    expect(rect("$user").y).toBeLessThan(rect("$app").y);
    expect(rect("$app").y).toBeLessThan(rect("$db").y);
    expect(rect("$user").x).toBe(rect("$db").x);
    expect(rect("$user").width).toBe(rect("$db").width);
    expect(rect("$s").x).toBeLessThan(rect("$f").x);
    expect(rect("$f").x).toBeLessThan(rect("$v").x);
    expect(rect("$v").x).toBeLessThan(rect("$q").x);
    expect(rect("$q").x).toBeLessThan(rect("$ok").x);
    expect(rect("$ok").x).toBeLessThan(rect("$e").x);
    const lanes = ["$user", "$app", "$db"].map(rect);
    lanes.forEach((a, i) =>
      lanes.forEach((b, j) => {
        if (i !== j) expect(rectsIntersect(a, b)).toBe(false);
      }),
    );
    const steps = document.nodes
      .filter((n) => !["swimlane"].includes(n.type))
      .map((n) => getNodeRect(n, registry));
    steps.forEach((a, i) =>
      steps.forEach((b, j) => {
        if (i !== j) expect(rectsIntersect(a, b)).toBe(false);
      }),
    );
  });

  it("infers lanes from connections and ignores unknown lane names with a warning", () => {
    const empty: FlowJSON = { version: 1, nodes: [], edges: [], meta: { name: "x" } };
    const result = ok(
      [
        { op: "addNode", tempId: "$a", type: "swimlane", label: "A" },
        { op: "addNode", tempId: "$b", type: "swimlane", label: "B" },
        { op: "addNode", tempId: "$one", type: "process", label: "One", lane: "$b" },
        { op: "addNode", tempId: "$two", type: "process", label: "Two", lane: "Nowhere" },
        { op: "addEdge", source: "$one", target: "$two" },
      ],
      empty,
    );
    const r = (t: string) => getNodeRect(byId(result.document, result.idMap[t]!), registry);
    const laneB = r("$b");
    expect(r("$two").y).toBeGreaterThanOrEqual(laneB.y);
    expect(r("$two").y + r("$two").height).toBeLessThanOrEqual(laneB.y + laneB.height);
    expect(result.warnings.some((w) => w.includes("Nowhere"))).toBe(true);
  });

  it("drops a step into an existing lane without rearranging the rest", () => {
    const doc: FlowJSON = {
      version: 1,
      nodes: [
        { ...node("lane1", "swimlane", "Customer", 0, 0), width: 600, height: 200 },
        node("s1", "process", "Browse", 80, 70),
      ],
      edges: [],
      meta: { name: "x" },
    };
    const { document, idMap } = ok(
      [{ op: "addNode", tempId: "$n", type: "process", label: "Pay", lane: "Customer" }],
      doc,
    );
    expect(byId(document, "s1").position).toEqual({ x: 80, y: 70 });
    const added = getNodeRect(byId(document, idMap.$n!), registry);
    const lane = getNodeRect(byId(document, "lane1"), registry);
    expect(added.x).toBeGreaterThan(80 + 100);
    expect(added.y).toBeGreaterThanOrEqual(lane.y);
    expect(added.y + added.height).toBeLessThanOrEqual(lane.y + lane.height);
  });

  it("handles ambiguous labels and duplicate temp ids", () => {
    const doc = baseFlow();
    doc.nodes.push(node("start2", "process", "Start", 0, 400));
    const errors = errorsOf(
      [
        { op: "removeNode", node: "Start" },
        { op: "addNode", tempId: "$a", type: "process", label: "a" },
        { op: "addNode", tempId: "$a", type: "process", label: "b" },
      ],
      doc,
    );
    expect(errors.map((e) => [e.index, e.code])).toEqual([
      [0, "ambiguous_ref"],
      [2, "duplicate_temp_id"],
    ]);
  });

  it("is all or nothing and enforces limits", () => {
    const input = baseFlow();
    const snapshot = JSON.stringify(input);
    const errors = errorsOf(
      [
        { op: "addNode", type: "process", label: "ok" },
        { op: "removeEdge", edge: "nope" },
        { op: "addEdge", source: "$ghost", target: "done" },
      ],
      input,
    );
    expect(errors.map((e) => e.index)).toEqual([1, 2]);
    expect(JSON.stringify(input)).toBe(snapshot);
    const tooMany = Array.from({ length: AI_FLOW_LIMITS.maxOpsPerBatch + 1 }, (): FlowOp => ({
      op: "setFlowNotes",
      notes: "x",
    }));
    expect(errorsOf(tooMany)[0]?.code).toBe("limit_exceeded");
  });

  it("survives parseFlow unchanged and reports a diff", () => {
    const { document, diff } = ok([
      { op: "addNode", tempId: "$p", type: "process", label: "P", properties: { k: 1 } },
      { op: "addEdge", source: "start", target: "$p" },
    ]);
    expect(parseFlow(JSON.parse(JSON.stringify(document)))).toEqual(document);
    expect(diff.added).toHaveLength(2);
    expect(diffFlow(document, document)).toEqual({ added: [], changed: [], removed: [] });
  });

  it("summarizes a flow", () => {
    const summary = summarizeFlow(baseFlow());
    expect(summary).toMatchObject({ name: "Checkout", nodeCount: 3, edgeCount: 2 });
    expect(summary.edges[1]).toMatchObject({ sourceHandle: "yes", label: "Yes" });
  });
});

describe("parseFlowOps", () => {
  it("accepts every op kind", () => {
    const ops: FlowOp[] = [
      {
        op: "addNode",
        tempId: "$a",
        type: "process",
        label: "a",
        description: "d",
        properties: { x: null },
        near: "b",
        placement: "left",
      },
      { op: "updateNode", node: "a", patch: { description: null } },
      { op: "removeNode", node: "a" },
      { op: "addEdge", source: "a", target: "b", sourceHandle: "yes", type: "step", label: "l" },
      { op: "updateEdge", edge: "e", patch: { label: null } },
      { op: "removeEdge", edge: "e" },
      { op: "insertNodeOnEdge", edge: "e", type: "process", label: "x" },
      { op: "setFlowName", name: "n" },
      { op: "setFlowNotes", notes: "" },
      { op: "autoLayout", direction: "LR" },
    ];
    expect(parseFlowOps(ops)).toEqual({ ok: true, ops });
  });

  it("accepts a lane reference on addNode and rejects a non-string one", () => {
    const good: FlowOp[] = [{ op: "addNode", type: "process", label: "Pay", lane: "Customer" }];
    expect(parseFlowOps(good)).toEqual({ ok: true, ops: good });
    const bad = parseFlowOps([{ op: "addNode", type: "process", label: "Pay", lane: 3 }]);
    expect(bad.ok).toBe(false);
  });

  it("collects shape errors", () => {
    const result = parseFlowOps([
      { op: "addNode", type: "process" },
      { op: "addEdge", source: "a", target: 3 },
      { op: "autoLayout", direction: "RL" },
      { op: "updateNode", node: "a", patch: { properties: { k: [1] } } },
    ]);
    expect(result.ok === false && result.errors.map((e) => e.index)).toEqual([0, 1, 2, 3]);
  });
});

import { describe, expect, it } from "vitest";
import { FlowEngine } from "../src/utils/flowchart/flowEngine";
import { HistoryManager } from "../src/utils/flowchart/historyManager";
import { validateFlow } from "../src/utils/flowchart/validator";
import { NodeTypeRegistry } from "../src/utils/flowchart/nodeTypes";
import { FlowParseError, parseFlow } from "../src/utils/flowchart/serialization";
import { getBezierPath, getStepPoints } from "../src/utils/flowchart/edgePaths";

function simpleFlow() {
  const engine = new FlowEngine();
  const start = engine.addNode({ type: "start", position: { x: 0, y: 0 } });
  const proc = engine.addNode({ type: "process", position: { x: 0, y: 150 } });
  const end = engine.addNode({ type: "end", position: { x: 0, y: 300 } });
  return { engine, start, proc, end };
}

describe("HistoryManager", () => {
  it("undoes and redoes in order", () => {
    const h = new HistoryManager<number>();
    h.push(1);
    h.push(2);
    expect(h.undo(3)).toBe(2);
    expect(h.undo(2)).toBe(1);
    expect(h.undo(1)).toBeUndefined();
    expect(h.redo(1)).toBe(2);
    h.push(9);
    expect(h.canRedo).toBe(false);
  });

  it("respects the limit", () => {
    const h = new HistoryManager<number>(2);
    [1, 2, 3].forEach((n) => h.push(n));
    expect(h.undo(4)).toBe(3);
    expect(h.undo(3)).toBe(2);
    expect(h.undo(2)).toBeUndefined();
  });
});

describe("FlowEngine", () => {
  it("adds nodes with defaults from the type definition", () => {
    const { proc } = simpleFlow();
    expect(proc.data.label).toBe("Process");
    expect(proc.data.properties).toEqual({});
  });

  it("adds valid edges and applies default decision labels", () => {
    const engine = new FlowEngine();
    const d = engine.addNode({ type: "decision", position: { x: 0, y: 0 } });
    const a = engine.addNode({ type: "process", position: { x: 0, y: 200 } });
    const edge = engine.addEdge({ source: d.id, sourceHandle: "yes", target: a.id });
    expect(edge?.label).toBe("Yes");
    expect(edge?.targetHandle).toBe("in-top");
  });

  it("rejects invalid connections", () => {
    const { engine, start, proc, end } = simpleFlow();
    expect(engine.addEdge({ source: proc.id, target: proc.id })).toBeNull();
    expect(engine.canConnect({ source: end.id, target: proc.id }).valid).toBe(false);
    expect(engine.canConnect({ source: proc.id, target: start.id }).valid).toBe(false);
    expect(engine.addEdge({ source: start.id, target: proc.id })).not.toBeNull();
    expect(engine.addEdge({ source: start.id, target: proc.id })).toBeNull(); // duplicate
  });

  it("removes connected edges with a node", () => {
    const { engine, start, proc } = simpleFlow();
    engine.addEdge({ source: start.id, target: proc.id });
    engine.removeNodes([proc.id]);
    expect(engine.getEdges()).toHaveLength(0);
  });

  it("undo / redo restores graph state", () => {
    const { engine, start, proc } = simpleFlow();
    engine.addEdge({ source: start.id, target: proc.id });
    expect(engine.getEdges()).toHaveLength(1);
    engine.undo();
    expect(engine.getEdges()).toHaveLength(0);
    engine.redo();
    expect(engine.getEdges()).toHaveLength(1);
    engine.undo();
    engine.undo();
    expect(engine.getNodes()).toHaveLength(2);
  });

  it("groups an interaction into one undo step", () => {
    const { engine, proc } = simpleFlow();
    engine.beginInteraction();
    for (let i = 1; i <= 10; i++) engine.setNodePositions({ [proc.id]: { x: i * 10, y: 150 } });
    engine.endInteraction();
    expect(engine.getNode(proc.id)!.position.x).toBe(100);
    engine.undo();
    expect(engine.getNode(proc.id)!.position.x).toBe(0);
  });

  it("deleteSelection removes nodes and edges and is undoable", () => {
    const { engine, start, proc } = simpleFlow();
    engine.addEdge({ source: start.id, target: proc.id });
    engine.setSelection([proc.id]);
    engine.deleteSelection();
    expect(engine.getNodes()).toHaveLength(2);
    expect(engine.getState().selectedNodeIds.size).toBe(0);
    engine.undo();
    expect(engine.getNodes()).toHaveLength(3);
    expect(engine.getEdges()).toHaveLength(1);
  });

  it("selects nodes inside a rectangle", () => {
    const { engine, start, proc } = simpleFlow();
    engine.selectInRect({ x: -10, y: -10, width: 300, height: 200 });
    expect([...engine.getState().selectedNodeIds].sort()).toEqual([start.id, proc.id].sort());
  });

  it("zooms around a fixed point", () => {
    const engine = new FlowEngine();
    engine.setCanvasSize({ width: 800, height: 600 });
    const before = engine.screenToFlow({ x: 200, y: 100 });
    engine.zoomAt(2, { x: 200, y: 100 });
    const after = engine.screenToFlow({ x: 200, y: 100 });
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(engine.getState().viewport.zoom).toBe(2);
  });

  it("fits all nodes into the canvas", () => {
    const { engine } = simpleFlow();
    engine.setCanvasSize({ width: 1000, height: 800 });
    engine.fitView();
    const v = engine.getState().viewport;
    for (const n of engine.getNodes()) {
      const r = engine.getNodeRect(n);
      expect(r.x * v.zoom + v.x).toBeGreaterThanOrEqual(0);
      expect((r.y + r.height) * v.zoom + v.y).toBeLessThanOrEqual(800);
    }
  });

  it("interactive connection snaps to the nearest handle", () => {
    const { engine, start, proc } = simpleFlow();
    engine.startConnection({ nodeId: start.id, handleId: "out", kind: "source" }, { x: 90, y: 56 });
    engine.updateConnection({ x: 75, y: 152 }); // inside the process node, near its top edge
    expect(engine.getState().connection?.candidate).toEqual({
      nodeId: proc.id,
      handleId: "in-top",
    });
    expect(engine.getState().connection?.valid).toBe(true);
    const edge = engine.endConnection();
    expect(edge?.source).toBe(start.id);
    expect(engine.getState().connection).toBeNull();
  });

  it("exports and re-imports JSON", () => {
    const { engine, start, proc } = simpleFlow();
    engine.addEdge({ source: start.id, target: proc.id });
    const json = JSON.stringify(engine.toJSON());
    const other = new FlowEngine();
    other.loadFlow(parseFlow(json));
    expect(other.getNodes()).toEqual(engine.getNodes());
    expect(other.getEdges()).toEqual(engine.getEdges());
    expect(other.getState().canUndo).toBe(false);
  });

  it("drops legacy flow-level notes when a loaded flow is saved again", () => {
    const { engine } = simpleFlow();
    const legacy = { ...engine.toJSON(), meta: { name: "Checkout", notes: "Old notes" } };

    const other = new FlowEngine();
    other.loadFlow(parseFlow(JSON.stringify(legacy)));

    expect(other.getState().flowName).toBe("Checkout");
    expect(other.toJSON().meta).not.toHaveProperty("notes");
  });

  it("emits change events", () => {
    const engine = new FlowEngine();
    let count = 0;
    engine.on("change", () => count++);
    engine.addNode({ type: "start", position: { x: 0, y: 0 } });
    engine.setSelection([]);
    expect(count).toBe(1);
  });
});

describe("Validator", () => {
  const registry = new NodeTypeRegistry();

  it("requires start and end nodes", () => {
    const result = validateFlow({ nodes: [], edges: [] }, registry);
    expect(result.issues.map((i) => i.code)).toEqual(["start-required", "end-required"]);
    expect(result.valid).toBe(false);
  });

  it("detects disconnected nodes and invalid edges", () => {
    const { engine, start, end } = simpleFlow();
    const edges = [{ id: "bad", source: end.id, target: start.id }];
    const result = validateFlow({ nodes: engine.getNodes(), edges }, registry);
    const codes = result.issues.map((i) => i.code);
    expect(codes).toContain("invalid-connection");
    expect(codes).toContain("disconnected");
  });

  it("accepts a well-formed flow", () => {
    const { engine, start, proc, end } = simpleFlow();
    engine.addEdge({ source: start.id, target: proc.id });
    engine.addEdge({ source: proc.id, target: end.id });
    expect(engine.validate().valid).toBe(true);
    expect(engine.validate().issues).toHaveLength(0);
  });
});

describe("serialization", () => {
  it("reports readable errors", () => {
    expect(() => parseFlow("{")).toThrow(FlowParseError);
    expect(() => parseFlow({ nodes: [{ id: "a" }] })).toThrow(/type/);
    expect(() =>
      parseFlow({
        nodes: [
          { id: "a", type: "x", position: { x: 0, y: 0 } },
          { id: "a", type: "x", position: { x: 0, y: 0 } },
        ],
      }),
    ).toThrow(/Duplicate/);
  });

  it("fills in missing optional fields", () => {
    const flow = parseFlow({
      nodes: [{ id: "a", type: "process", position: { x: 1, y: 2 } }],
      edges: [{ source: "a", target: "b" }],
    });
    expect(flow.nodes[0].data).toEqual({ label: "process", description: "", properties: {} });
    expect(flow.edges[0].id).toMatch(/^edge_/);
  });
});

describe("edge paths", () => {
  it("bezier label sits between endpoints", () => {
    const p = getBezierPath({
      source: { x: 0, y: 0 },
      sourceSide: "bottom",
      target: { x: 0, y: 200 },
      targetSide: "top",
    });
    expect(p.labelY).toBeCloseTo(100);
    expect(p.path.startsWith("M 0,0 C")).toBe(true);
  });

  it("step route is orthogonal", () => {
    const pts = getStepPoints({
      source: { x: 0, y: 0 },
      sourceSide: "bottom",
      target: { x: 100, y: 200 },
      targetSide: "top",
    });
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i].x === pts[i - 1].x || pts[i].y === pts[i - 1].y).toBe(true);
    }
  });
});

describe("regressions", () => {
  it("gives pasted nodes their own meta object", () => {
    const engine = new FlowEngine();
    const node = engine.addNode({ type: "process", position: { x: 0, y: 0 } });
    engine.updateNode(node.id, { data: { ...node.data, meta: { tags: ["a"] } } });
    engine.selectNode(node.id);
    engine.copySelection();
    const [copy] = engine.paste();

    const copied = engine.getNode(copy.id)!.data.meta as { tags: string[] };
    copied.tags.push("b");

    const original = engine.getNode(node.id)!.data.meta as { tags: string[] };
    expect(original.tags).toEqual(["a"]);
  });

  it("clears an in-flight connection when another flow is loaded", () => {
    const { engine, start } = simpleFlow();
    engine.startConnection(
      { nodeId: start.id, handleId: "out-bottom", kind: "source" },
      { x: 10, y: 10 },
    );
    expect(engine.getState().connection).not.toBeNull();

    engine.loadFlow({ nodes: [], edges: [] });
    expect(engine.getState().connection).toBeNull();
  });

  it("restores the pre-drag graph when an interaction is cancelled", () => {
    const { engine, proc } = simpleFlow();
    const origin = { ...engine.getNode(proc.id)!.position };
    const undoDepthBefore = engine.getState().canUndo;

    engine.beginInteraction();
    engine.setNodePositions({ [proc.id]: { x: 999, y: 999 } });
    engine.cancelInteraction();

    expect(engine.getNode(proc.id)!.position).toEqual(origin);
    expect(engine.getState().canUndo).toBe(undoDepthBefore);

    engine.undo();
    expect(engine.getNode(proc.id)!.position).toEqual(origin);
  });

  it("keeps undo working after an interaction is abandoned", () => {
    const { engine, proc } = simpleFlow();
    engine.beginInteraction();
    engine.cancelInteraction();

    engine.updateNode(proc.id, { data: { ...proc.data, label: "Renamed" } });
    engine.undo();

    expect(engine.getNode(proc.id)!.data.label).toBe(proc.data.label);
  });

  it("rejects a document whose version is newer than this editor", () => {
    expect(() => parseFlow({ version: 99, nodes: [], edges: [] })).toThrow(FlowParseError);
  });

  it("rejects duplicate edge ids on import", () => {
    expect(() =>
      parseFlow({
        version: 1,
        nodes: [
          { id: "a", type: "start", position: { x: 0, y: 0 }, data: { label: "A", properties: {} } },
          { id: "b", type: "end", position: { x: 0, y: 99 }, data: { label: "B", properties: {} } },
        ],
        edges: [
          { id: "e1", source: "a", target: "b" },
          { id: "e1", source: "b", target: "a" },
        ],
      }),
    ).toThrow(FlowParseError);
  });

  it("keeps issue ids stable when an unrelated issue is resolved", () => {
    const registry = new NodeTypeRegistry();
    const orphan = {
      id: "orphan",
      type: "process",
      position: { x: 0, y: 0 },
      data: { label: "Orphan", properties: {} },
    };
    const withoutStart = validateFlow({ nodes: [orphan], edges: [] }, registry);
    const before = withoutStart.issues.find((i) => i.code === "disconnected")!.id;

    const withStart = validateFlow(
      {
        nodes: [
          orphan,
          { id: "s", type: "start", position: { x: 0, y: 0 }, data: { label: "S", properties: {} } },
          { id: "e", type: "end", position: { x: 0, y: 9 }, data: { label: "E", properties: {} } },
        ],
        edges: [{ id: "e1", source: "s", target: "e" }],
      },
      registry,
    );
    const after = withStart.issues.find((i) => i.code === "disconnected")!.id;

    expect(after).toBe(before);
  });

  it("reports an unknown node type once instead of cascading structural errors", () => {
    const registry = new NodeTypeRegistry();
    const result = validateFlow(
      {
        nodes: [
          { id: "s", type: "start", position: { x: 0, y: 0 }, data: { label: "S", properties: {} } },
          {
            id: "t",
            type: "terminator",
            position: { x: 0, y: 99 },
            data: { label: "T", properties: {} },
          },
        ],
        edges: [{ id: "e1", source: "s", target: "t" }],
      },
      registry,
    );

    const errors = result.issues.filter((i) => i.severity === "error").map((i) => i.code);
    expect(errors).toContain("unknown-type");
    expect(errors).not.toContain("disconnected");
    expect(result.issues.map((i) => i.code)).not.toContain("dead-end");
  });
});

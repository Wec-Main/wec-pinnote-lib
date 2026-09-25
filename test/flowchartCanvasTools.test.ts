import { describe, expect, it } from "vitest";
import { FlowEngine } from "../src/utils/flowchart/flowEngine";
import { snapToAlignment } from "../src/utils/flowchart/alignment";

function threeProcesses() {
  const engine = new FlowEngine();
  const a = engine.addNode({ type: "process", position: { x: 0, y: 0 } });
  const b = engine.addNode({ type: "process", position: { x: 300, y: 40 } });
  const c = engine.addNode({ type: "process", position: { x: 1000, y: 90 } });
  return { engine, a, b, c };
}

describe("clipboard", () => {
  it("pastes copied nodes and their internal edges as new selected nodes", () => {
    const engine = new FlowEngine();
    const start = engine.addNode({ type: "start", position: { x: 0, y: 0 } });
    const end = engine.addNode({ type: "end", position: { x: 0, y: 200 } });
    engine.addEdge({ source: start.id, target: end.id });
    engine.setSelection([start.id, end.id]);

    expect(engine.copySelection()).toBe(true);
    const pasted = engine.paste({ x: 500, y: 500 });

    expect(pasted).toHaveLength(2);
    expect(engine.getNodes()).toHaveLength(4);
    expect(engine.getEdges()).toHaveLength(2);
    expect(pasted.map((n) => n.position)).toEqual([
      { x: 500, y: 500 },
      { x: 500, y: 700 },
    ]);
    expect([...engine.getState().selectedNodeIds]).toEqual(pasted.map((n) => n.id));
  });

  it("removes nodes on cut and pastes them back in one undo step", () => {
    const engine = new FlowEngine();
    const node = engine.addNode({ type: "process", position: { x: 10, y: 10 } });
    engine.setSelection([node.id]);

    expect(engine.cutSelection()).toBe(true);
    expect(engine.getNodes()).toHaveLength(0);
    engine.paste();
    expect(engine.getNodes()).toHaveLength(1);
    engine.undo();
    expect(engine.getNodes()).toHaveLength(0);
  });

  it("does nothing when nothing is selected or copied", () => {
    const engine = new FlowEngine();
    expect(engine.copySelection()).toBe(false);
    expect(engine.hasClipboard()).toBe(false);
    expect(engine.paste()).toEqual([]);
  });
});

describe("align and distribute", () => {
  it("aligns selected nodes to the left edge of the selection", () => {
    const { engine, a, b, c } = threeProcesses();
    engine.setSelection([a.id, b.id, c.id]);
    engine.alignSelection("left");
    expect(engine.getNodes().map((n) => n.position.x)).toEqual([0, 0, 0]);
  });

  it("distributes selected nodes with equal horizontal gaps", () => {
    const { engine, a, b, c } = threeProcesses();
    engine.setSelection([a.id, b.id, c.id]);
    engine.distributeSelection("horizontal");
    const [first, middle, last] = engine.getNodes().map((n) => n.position.x);
    expect(first).toBe(0);
    expect(last).toBe(1000);
    expect(middle).toBe(500);
  });

  it("ignores align with fewer than two nodes", () => {
    const { engine, a } = threeProcesses();
    engine.setSelection([a.id]);
    engine.alignSelection("right");
    expect(engine.getNode(a.id)?.position).toEqual({ x: 0, y: 0 });
  });
});

describe("snapToAlignment", () => {
  it("snaps to the nearest matching edge within the threshold and reports a guide", () => {
    const snap = snapToAlignment(
      { x: 103, y: 500, width: 50, height: 20 },
      [{ x: 100, y: 0, width: 80, height: 40 }],
      6,
    );
    expect(snap.offset).toEqual({ x: -3, y: 0 });
    expect(snap.guides).toEqual([{ axis: "x", position: 100, start: 0, end: 520 }]);
  });

  it("leaves the rect alone when nothing is close enough", () => {
    const snap = snapToAlignment(
      { x: 300, y: 300, width: 50, height: 20 },
      [{ x: 0, y: 0, width: 80, height: 40 }],
      6,
    );
    expect(snap).toEqual({ offset: { x: 0, y: 0 }, guides: [] });
  });
});

describe("default line style", () => {
  it("is written to meta and restored when the flow is loaded again", () => {
    const engine = new FlowEngine({ defaultEdgeType: "bezier" });
    engine.setDefaultEdgeType("step");
    const saved = engine.toJSON();
    expect(saved.meta?.edgeType).toBe("step");
    expect(
      new FlowEngine({ initialFlow: saved, defaultEdgeType: "bezier" }).getState().defaultEdgeType,
    ).toBe("step");
  });

  it("falls back to the configured default when meta has no valid line style", () => {
    const engine = new FlowEngine({
      initialFlow: { nodes: [], edges: [], meta: { edgeType: "zigzag" } },
      defaultEdgeType: "step",
    });
    expect(engine.getState().defaultEdgeType).toBe("step");
  });

  it("emits a change so the new line style and flow name get saved", () => {
    const engine = new FlowEngine();
    let changes = 0;
    engine.on("change", () => changes++);
    engine.setDefaultEdgeType("bezier");
    engine.setDefaultEdgeType("bezier");
    engine.setFlowName("Onboarding");
    expect(changes).toBe(2);
  });
});

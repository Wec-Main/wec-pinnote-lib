import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { FlowEngine } from "../../src/utils/flowchart/flowEngine";
import { FlowProvider } from "../../src/features/flowchart/components/FlowProvider";
import { NodeRenderer } from "../../src/features/flowchart/components/NodeRenderer";
import { ErdEngine } from "../../src/utils/erd/erdEngine";
import { ErdProvider } from "../../src/features/erd/components/erd/ErdProvider";
import { ErdCanvas } from "../../src/features/erd/components/erd/ErdCanvas";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function renderedNodeIds(): string[] {
  return [...container.querySelectorAll("[data-node-id]")].map((el) =>
    el.getAttribute("data-node-id")!,
  );
}

function renderedEntityIds(): string[] {
  // EntityHandle (left/right connection handles) also carries
  // data-entity-id, so scope to the entity's own container div.
  return [...container.querySelectorAll("div[data-entity-id]")].map((el) =>
    el.getAttribute("data-entity-id")!,
  );
}

describe("viewport culling: flowchart NodeRenderer", () => {
  it("renders every node in a small diagram, even ones far outside the viewport", () => {
    const engine = new FlowEngine();
    engine.setCanvasSize({ width: 800, height: 600 });
    engine.setViewport({ x: 0, y: 0, zoom: 1 });
    for (let i = 0; i < 5; i++) {
      engine.addNode({ type: "process", position: { x: i * 100, y: 0 } });
    }
    const farNode = engine.addNode({ type: "process", position: { x: 100_000, y: 100_000 } });

    act(() => {
      root.render(createElement(FlowProvider, { engine }, createElement(NodeRenderer)));
    });

    const ids = renderedNodeIds();
    expect(ids).toHaveLength(6);
    expect(ids).toContain(farNode.id);
  });

  it("does not mount nodes far outside the viewport in a large diagram", () => {
    const engine = new FlowEngine();
    engine.setCanvasSize({ width: 800, height: 600 });
    engine.setViewport({ x: 0, y: 0, zoom: 1 });

    const nearNode = engine.addNode({ type: "process", position: { x: 100, y: 100 } });
    for (let i = 1; i < 199; i++) {
      engine.addNode({
        type: "process",
        position: { x: (i % 4) * 150, y: Math.floor(i / 4) * 100 },
      });
    }
    const farNode = engine.addNode({ type: "process", position: { x: 500_000, y: 500_000 } });

    expect(engine.getNodes().length).toBeGreaterThan(150);

    act(() => {
      root.render(createElement(FlowProvider, { engine }, createElement(NodeRenderer)));
    });

    const ids = renderedNodeIds();
    expect(ids.length).toBeLessThan(engine.getNodes().length);
    expect(ids).toContain(nearNode.id);
    expect(ids).not.toContain(farNode.id);
  });

  it("keeps a selected node mounted even once it falls outside the culled viewport", () => {
    const engine = new FlowEngine();
    engine.setCanvasSize({ width: 800, height: 600 });
    engine.setViewport({ x: 0, y: 0, zoom: 1 });

    for (let i = 0; i < 199; i++) {
      engine.addNode({
        type: "process",
        position: { x: (i % 4) * 150, y: Math.floor(i / 4) * 100 },
      });
    }
    const farNode = engine.addNode({ type: "process", position: { x: 500_000, y: 500_000 } });
    engine.setSelection([farNode.id]);

    act(() => {
      root.render(createElement(FlowProvider, { engine }, createElement(NodeRenderer)));
    });

    expect(renderedNodeIds()).toContain(farNode.id);
  });
});

describe("viewport culling: ERD ViewportLayer", () => {
  it("renders every entity in a small data model, even ones far outside the viewport", () => {
    const engine = new ErdEngine();
    engine.setCanvasSize({ width: 800, height: 600 });
    for (let i = 0; i < 5; i++) {
      engine.addEntity({ position: { x: i * 260, y: 0 } });
    }
    const farEntity = engine.addEntity({ position: { x: 100_000, y: 100_000 } });

    act(() => {
      root.render(createElement(ErdProvider, { engine }, createElement(ErdCanvas)));
    });

    const ids = renderedEntityIds();
    expect(ids).toHaveLength(6);
    expect(ids).toContain(farEntity.id);
  });

  it("does not mount entities far outside the viewport in a large data model", () => {
    const engine = new ErdEngine();
    engine.setCanvasSize({ width: 800, height: 600 });

    const nearEntity = engine.addEntity({ position: { x: 100, y: 100 } });
    for (let i = 1; i < 199; i++) {
      engine.addEntity({ position: { x: (i % 4) * 260, y: Math.floor(i / 4) * 160 } });
    }
    const farEntity = engine.addEntity({ position: { x: 500_000, y: 500_000 } });

    expect(engine.getState().entities.length).toBeGreaterThan(150);

    act(() => {
      root.render(createElement(ErdProvider, { engine }, createElement(ErdCanvas)));
    });

    const ids = renderedEntityIds();
    expect(ids.length).toBeLessThan(engine.getState().entities.length);
    expect(ids).toContain(nearEntity.id);
    expect(ids).not.toContain(farEntity.id);
  });
});

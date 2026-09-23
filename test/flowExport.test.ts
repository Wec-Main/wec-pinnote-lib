import { describe, it, expect } from "vitest";
import { exportFlow } from "../src/components/WecFlow/vendor/utils/flowExport";
import type { FlowDefinition } from "../src/components/WecFlow/vendor/types/flow.types";

function makeSampleFlow(): FlowDefinition {
  return {
    id: "flow-1",
    name: "Sample Flow",
    description: "A small sample flow used for tests.",
    nodes: [
      {
        id: "n1",
        type: "start",
        position: { x: 0, y: 0 },
        data: { label: "Start" },
      },
      {
        id: "n2",
        type: "process",
        position: { x: 100, y: 0 },
        data: { label: "Do something", description: "Step 1" },
      },
      {
        id: "n3",
        type: "end",
        position: { x: 200, y: 0 },
        data: { label: "End" },
      },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3", label: "next" },
    ],
  };
}

describe("exportFlow", () => {
  it("produces a JSON string", () => {
    const flow = makeSampleFlow();
    const json = exportFlow(flow);
    expect(typeof json).toBe("string");
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("round-trips to an equal FlowDefinition", () => {
    const flow = makeSampleFlow();
    const json = exportFlow(flow);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(flow);
  });

  it("formats output with indentation (pretty-printed)", () => {
    const flow = makeSampleFlow();
    const json = exportFlow(flow);
    expect(json).toContain("\n");
    expect(json.startsWith("{")).toBe(true);
  });
});

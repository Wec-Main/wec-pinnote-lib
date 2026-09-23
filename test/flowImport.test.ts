import { describe, it, expect } from "vitest";
import { importFlow, FlowImportError } from "../src/components/WecFlow/vendor/utils/flowImport";
import { exportFlow } from "../src/components/WecFlow/vendor/utils/flowExport";
import type { FlowDefinition } from "../src/components/WecFlow/vendor/types/flow.types";

function makeSampleFlow(): FlowDefinition {
  return {
    id: "flow-1",
    name: "Sample Flow",
    nodes: [
      {
        id: "n1",
        type: "start",
        position: { x: 0, y: 0 },
        data: { label: "Start" },
      },
      {
        id: "n2",
        type: "end",
        position: { x: 100, y: 0 },
        data: { label: "End" },
      },
    ],
    edges: [{ id: "e1", source: "n1", target: "n2" }],
  };
}

describe("importFlow", () => {
  it("imports a valid exported flow into an equal FlowDefinition", () => {
    const flow = makeSampleFlow();
    const json = exportFlow(flow);
    const imported = importFlow(json);
    expect(imported).toEqual(flow);
  });

  it("throws FlowImportError for invalid JSON text", () => {
    expect(() => importFlow("{not valid json")).toThrow(FlowImportError);
  });

  it("throws FlowImportError when nodes is missing", () => {
    const bad = { id: "f1", name: "F", edges: [] };
    expect(() => importFlow(JSON.stringify(bad))).toThrow(FlowImportError);
  });

  it("throws FlowImportError when a node has a bad type", () => {
    const bad = {
      id: "f1",
      name: "F",
      nodes: [
        {
          id: "n1",
          type: "not-a-real-type",
          position: { x: 0, y: 0 },
          data: { label: "x" },
        },
      ],
      edges: [],
    };
    expect(() => importFlow(JSON.stringify(bad))).toThrow(FlowImportError);
  });

  it("throws FlowImportError when an edge is missing source", () => {
    const bad = {
      id: "f1",
      name: "F",
      nodes: [
        {
          id: "n1",
          type: "start",
          position: { x: 0, y: 0 },
          data: { label: "Start" },
        },
      ],
      edges: [{ id: "e1", target: "n1" }],
    };
    expect(() => importFlow(JSON.stringify(bad))).toThrow(FlowImportError);
  });

  it.each(["42", "null", "[]", '"just a string"', "true"])(
    "throws FlowImportError rather than crashing for non-object JSON: %s",
    (json) => {
      expect(() => importFlow(json)).toThrow(FlowImportError);
    },
  );

  it("throws FlowImportError with a message pinpointing the bad node index", () => {
    const bad = {
      id: "f1",
      name: "F",
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
          position: { x: 0, y: 0 },
          data: { label: "ok" },
        },
        {
          id: "n3",
          position: { x: 0, y: 0 },
          data: { label: "missing type" },
        },
      ],
      edges: [],
    };

    try {
      importFlow(JSON.stringify(bad));
      expect.fail("expected importFlow to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(FlowImportError);
      expect((error as FlowImportError).message).toContain("nodes[2]");
    }
  });
});

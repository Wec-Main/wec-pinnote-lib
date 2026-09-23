import { describe, it, expect } from "vitest";
import { validateFlow } from "../src/components/WecFlow/vendor/utils/flowValidation";
import type { FlowDefinition } from "../src/components/WecFlow/vendor/types/flow.types";

function makeValidFlow(): FlowDefinition {
  return {
    id: "flow-1",
    name: "Simple Flow",
    nodes: [
      {
        id: "start",
        type: "start",
        position: { x: 0, y: 0 },
        data: { label: "Start" },
      },
      {
        id: "process",
        type: "process",
        position: { x: 100, y: 0 },
        data: { label: "Process" },
      },
      {
        id: "end",
        type: "end",
        position: { x: 200, y: 0 },
        data: { label: "End" },
      },
    ],
    edges: [
      { id: "e1", source: "start", target: "process" },
      { id: "e2", source: "process", target: "end" },
    ],
  };
}

describe("validateFlow", () => {
  it("returns valid: true with no errors for a valid simple flow", () => {
    const result = validateFlow(makeValidFlow());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("flags a duplicate node id", () => {
    const flow = makeValidFlow();
    flow.nodes.push({
      id: "start",
      type: "process",
      position: { x: 300, y: 0 },
      data: { label: "Duplicate" },
    });

    const result = validateFlow(flow);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      code: "DUPLICATE_NODE_ID",
      message: 'Duplicate node id: "start".',
      nodeId: "start",
    });
  });

  it("flags an edge pointing to a nonexistent target node", () => {
    const flow = makeValidFlow();
    flow.edges.push({ id: "e3", source: "end", target: "does-not-exist" });

    const result = validateFlow(flow);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      code: "EDGE_TARGET_NOT_FOUND",
      message: 'Edge "e3" references a target node "does-not-exist" that does not exist.',
      edgeId: "e3",
    });
  });

  it("flags a start node with an incoming edge", () => {
    const flow = makeValidFlow();
    flow.edges.push({ id: "e3", source: "process", target: "start" });

    const result = validateFlow(flow);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      code: "START_HAS_INCOMING",
      message: 'Start node "start" should not have incoming connections.',
      nodeId: "start",
    });
  });

  it("flags an end node with an outgoing edge", () => {
    const flow = makeValidFlow();
    flow.edges.push({ id: "e3", source: "end", target: "process" });

    const result = validateFlow(flow);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      code: "END_HAS_OUTGOING",
      message: 'End node "end" should not have outgoing connections.',
      nodeId: "end",
    });
  });

  it("returns all violations at once when multiple problems exist", () => {
    const flow: FlowDefinition = {
      id: "flow-2",
      name: "Broken Flow",
      nodes: [
        {
          id: "start",
          type: "start",
          position: { x: 0, y: 0 },
          data: { label: "Start" },
        },
        {
          id: "start",
          type: "start",
          position: { x: 0, y: 50 },
          data: { label: "Duplicate start" },
        },
        {
          id: "end",
          type: "end",
          position: { x: 200, y: 0 },
          data: { label: "End" },
        },
      ],
      edges: [
        { id: "e1", source: "start", target: "missing-node" },
        { id: "e1", source: "end", target: "start" },
      ],
    };

    const result = validateFlow(flow);
    expect(result.valid).toBe(false);

    const codes = result.errors.map((error) => error.code).sort();
    // Two distinct node objects share the (invalid, duplicate) id "start",
    // and both are start-type nodes with an incoming edge, so
    // START_HAS_INCOMING is correctly reported once per offending node
    // object, not deduplicated by id.
    expect(codes).toEqual(
      [
        "DUPLICATE_NODE_ID",
        "DUPLICATE_EDGE_ID",
        "EDGE_TARGET_NOT_FOUND",
        "START_HAS_INCOMING",
        "START_HAS_INCOMING",
        "END_HAS_OUTGOING",
      ].sort(),
    );
  });

  it("does not throw for a flow with zero nodes and zero edges", () => {
    const flow: FlowDefinition = {
      id: "empty",
      name: "Empty Flow",
      nodes: [],
      edges: [],
    };

    expect(() => validateFlow(flow)).not.toThrow();
    const result = validateFlow(flow);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("does not throw and allows multiple start/end and disconnected nodes", () => {
    const flow: FlowDefinition = {
      id: "multi",
      name: "Multiple Start/End",
      nodes: [
        {
          id: "s1",
          type: "start",
          position: { x: 0, y: 0 },
          data: { label: "Start 1" },
        },
        {
          id: "s2",
          type: "start",
          position: { x: 0, y: 100 },
          data: { label: "Start 2" },
        },
        {
          id: "e1",
          type: "end",
          position: { x: 200, y: 0 },
          data: { label: "End 1" },
        },
        {
          id: "e2",
          type: "end",
          position: { x: 200, y: 100 },
          data: { label: "End 2" },
        },
        {
          id: "orphan",
          type: "process",
          position: { x: 400, y: 400 },
          data: { label: "Disconnected" },
        },
      ],
      edges: [
        { id: "edge1", source: "s1", target: "e1" },
        { id: "edge2", source: "s2", target: "e2" },
      ],
    };

    expect(() => validateFlow(flow)).not.toThrow();
    const result = validateFlow(flow);
    expect(result.valid).toBe(true);
  });
});

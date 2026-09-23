import { describe, expect, it } from 'vitest';
import { FlowEngine } from '../src/components/WecFlow/flowchart/core/FlowEngine';
import { getStepBend, getStepPoints } from '../src/components/WecFlow/flowchart/utils/edgePaths';
import { parseFlow } from '../src/components/WecFlow/flowchart/utils/serialization';

function startProcessEnd() {
  const engine = new FlowEngine();
  const start = engine.addNode({ type: 'start', position: { x: 0, y: 0 } });
  const proc = engine.addNode({ type: 'process', position: { x: 300, y: 200 } });
  const end = engine.addNode({ type: 'end', position: { x: 0, y: 500 } });
  const edge = engine.addEdge({ source: start.id, target: proc.id });
  if (!edge) throw new Error('edge not created');
  return { engine, start, proc, end, edge };
}

describe('step bend', () => {
  const input = { source: { x: 0, y: 0 }, sourceSide: 'bottom' as const, target: { x: 200, y: 200 }, targetSide: 'top' as const };

  it('defaults the middle segment to halfway between the two ends', () => {
    expect(getStepBend(input)).toEqual({ axis: 'y', value: 100, handle: { x: 100, y: 100 }, span: [0, 200] });
  });

  it('moves the middle segment to the requested bend', () => {
    const points = getStepPoints({ ...input, bend: 150 });
    expect(points).toContainEqual({ x: 0, y: 150 });
    expect(points).toContainEqual({ x: 200, y: 150 });
  });

  it('keeps a single corner for mixed sides until a bend is set', () => {
    const mixed = { source: { x: 0, y: 0 }, sourceSide: 'right' as const, target: { x: 200, y: 200 }, targetSide: 'top' as const };
    expect(getStepPoints(mixed)).toEqual([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }]);
    expect(getStepPoints({ ...mixed, bend: 100 })).toHaveLength(5);
  });

  it('is stored on the edge, survives parsing and can be cleared', () => {
    const { engine, edge } = startProcessEnd();
    engine.setEdgeBend(edge.id, 120);
    expect(parseFlow(JSON.stringify(engine.toJSON())).edges[0]?.bend).toBe(120);
    engine.setEdgeBend(edge.id, undefined);
    expect(engine.getEdge(edge.id)).not.toHaveProperty('bend');
  });
});

describe('reconnect', () => {
  it('moves the dragged end to a new node and keeps the edge id', () => {
    const { engine, end, edge } = startProcessEnd();
    engine.startReconnect(edge.id, 'target', { x: 0, y: 0 });
    engine.updateConnection({ x: end.position.x + 90, y: end.position.y + 1 });
    const updated = engine.endConnection();
    expect(updated?.id).toBe(edge.id);
    expect(engine.getEdge(edge.id)?.target).toBe(end.id);
    expect(engine.getEdges()).toHaveLength(1);
  });

  it('leaves the edge unchanged when released away from a handle', () => {
    const { engine, proc, edge } = startProcessEnd();
    engine.startReconnect(edge.id, 'target', { x: 0, y: 0 });
    engine.updateConnection({ x: 5000, y: 5000 });
    expect(engine.endConnection()).toBeNull();
    expect(engine.getEdge(edge.id)?.target).toBe(proc.id);
  });
});

describe('edge editing', () => {
  it('inserts a node on an edge and splits it into two connections', () => {
    const { engine, start, proc, edge } = startProcessEnd();
    const node = engine.insertNodeOnEdge(edge.id, 'decision');
    expect(node).not.toBeNull();
    expect(engine.getEdge(edge.id)).toBeUndefined();
    const pairs = engine.getEdges().map((e) => [e.source, e.target]);
    expect(pairs).toEqual([
      [start.id, node?.id],
      [node?.id, proc.id],
    ]);
  });

  it('reverses a connection when allowed and refuses when the target cannot start one', () => {
    const engine = new FlowEngine();
    const a = engine.addNode({ type: 'process', position: { x: 0, y: 0 } });
    const b = engine.addNode({ type: 'process', position: { x: 0, y: 200 } });
    const end = engine.addNode({ type: 'end', position: { x: 0, y: 400 } });
    const ab = engine.addEdge({ source: a.id, target: b.id });
    const bEnd = engine.addEdge({ source: b.id, target: end.id });
    if (!ab || !bEnd) throw new Error('edges not created');

    expect(engine.reverseEdge(ab.id)).toBe(true);
    expect(engine.getEdge(ab.id)).toMatchObject({ source: b.id, target: a.id });
    expect(engine.reverseEdge(bEnd.id)).toBe(false);
  });

  it('adds a connected node on the requested side', () => {
    const engine = new FlowEngine();
    const proc = engine.addNode({ type: 'process', position: { x: 0, y: 0 } });
    const added = engine.addConnectedNode(proc.id, 'right', 'decision');
    expect(added?.position.x).toBeGreaterThan(220);
    expect(engine.getEdges()).toMatchObject([{ source: proc.id, target: added?.id }]);
    expect([...engine.getState().selectedNodeIds]).toEqual([added?.id]);
  });
});

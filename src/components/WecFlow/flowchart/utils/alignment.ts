import type { Rect, XYPosition } from '../models/FlowTypes';

export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type DistributeAxis = 'horizontal' | 'vertical';
type GuideAxis = 'x' | 'y';

export interface AlignmentGuide {
  axis: GuideAxis;
  position: number;
  start: number;
  end: number;
}

export interface AlignmentSnap {
  offset: XYPosition;
  guides: AlignmentGuide[];
}

export interface PlacedRect {
  id: string;
  rect: Rect;
}

interface AxisMatch {
  delta: number;
  position: number;
}

const anchors: Record<GuideAxis, (r: Rect) => number[]> = {
  x: (r) => [r.x, r.x + r.width / 2, r.x + r.width],
  y: (r) => [r.y, r.y + r.height / 2, r.y + r.height],
};

const crossSpan: Record<GuideAxis, (r: Rect) => [number, number]> = {
  x: (r) => [r.y, r.y + r.height],
  y: (r) => [r.x, r.x + r.width],
};

function nearestMatch(moving: number[], targets: number[], threshold: number): AxisMatch | null {
  let best: AxisMatch | null = null;
  for (const from of moving) {
    for (const to of targets) {
      const delta = to - from;
      if (Math.abs(delta) <= threshold && (best === null || Math.abs(delta) < Math.abs(best.delta))) best = { delta, position: to };
    }
  }
  return best;
}

function guideFor(axis: GuideAxis, position: number, snapped: Rect, others: Rect[]): AlignmentGuide {
  const aligned = others.filter((r) => anchors[axis](r).some((a) => Math.abs(a - position) < 0.5));
  const spans = [snapped, ...aligned].map(crossSpan[axis]);
  return { axis, position, start: Math.min(...spans.map(([s]) => s)), end: Math.max(...spans.map(([, e]) => e)) };
}

export function snapToAlignment(moving: Rect, others: Rect[], threshold: number): AlignmentSnap {
  const x = nearestMatch(anchors.x(moving), others.flatMap(anchors.x), threshold);
  const y = nearestMatch(anchors.y(moving), others.flatMap(anchors.y), threshold);
  const offset = { x: x ? x.delta : 0, y: y ? y.delta : 0 };
  const snapped = { ...moving, x: moving.x + offset.x, y: moving.y + offset.y };
  const guides: AlignmentGuide[] = [];
  if (x) guides.push(guideFor('x', x.position, snapped, others));
  if (y) guides.push(guideFor('y', y.position, snapped, others));
  return { offset, guides };
}

const alignedPosition: Record<AlignMode, (bounds: Rect, r: Rect) => XYPosition> = {
  left: (b, r) => ({ x: b.x, y: r.y }),
  center: (b, r) => ({ x: b.x + b.width / 2 - r.width / 2, y: r.y }),
  right: (b, r) => ({ x: b.x + b.width - r.width, y: r.y }),
  top: (b, r) => ({ x: r.x, y: b.y }),
  middle: (b, r) => ({ x: r.x, y: b.y + b.height / 2 - r.height / 2 }),
  bottom: (b, r) => ({ x: r.x, y: b.y + b.height - r.height }),
};

export function alignRects(items: PlacedRect[], bounds: Rect, mode: AlignMode): Record<string, XYPosition> {
  return Object.fromEntries(items.map(({ id, rect }) => [id, alignedPosition[mode](bounds, rect)]));
}

const distributeKeys: Record<DistributeAxis, { start: 'x' | 'y'; size: 'width' | 'height' }> = {
  horizontal: { start: 'x', size: 'width' },
  vertical: { start: 'y', size: 'height' },
};

export function distributeRects(items: PlacedRect[], bounds: Rect, axis: DistributeAxis): Record<string, XYPosition> {
  const { start, size } = distributeKeys[axis];
  const ordered = [...items].sort((a, b) => a.rect[start] - b.rect[start]);
  const occupied = ordered.reduce((total, { rect }) => total + rect[size], 0);
  const gap = (bounds[size] - occupied) / Math.max(1, ordered.length - 1);
  let cursor = bounds[start];
  const positions: Record<string, XYPosition> = {};
  for (const { id, rect } of ordered) {
    positions[id] = { x: rect.x, y: rect.y, [start]: cursor };
    cursor += rect[size] + gap;
  }
  return positions;
}

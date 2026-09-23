import type { EdgePathType, HandleSide, XYPosition } from '../models/FlowTypes';
import { clamp, sideVector } from './geometry';

export interface EdgePathInput {
  source: XYPosition;
  sourceSide: HandleSide;
  target: XYPosition;
  targetSide: HandleSide;
}

export interface EdgePath {
  /** SVG path "d" attribute. */
  path: string;
  /** Point where the label is placed. */
  labelX: number;
  labelY: number;
}

const r = (n: number) => Math.round(n * 100) / 100;

export function getStraightPath({ source, target }: EdgePathInput): EdgePath {
  return {
    path: `M ${r(source.x)},${r(source.y)} L ${r(target.x)},${r(target.y)}`,
    labelX: (source.x + target.x) / 2,
    labelY: (source.y + target.y) / 2,
  };
}

export function getBezierPath({ source, sourceSide, target, targetSide }: EdgePathInput): EdgePath {
  const distance = Math.hypot(target.x - source.x, target.y - source.y);
  const offset = clamp(distance * 0.45, 30, 220);
  const sv = sideVector[sourceSide];
  const tv = sideVector[targetSide];
  const c1 = { x: source.x + sv.x * offset, y: source.y + sv.y * offset };
  const c2 = { x: target.x + tv.x * offset, y: target.y + tv.y * offset };
  // Point on a cubic bezier at t = 0.5.
  const labelX = (source.x + 3 * c1.x + 3 * c2.x + target.x) / 8;
  const labelY = (source.y + 3 * c1.y + 3 * c2.y + target.y) / 8;
  return {
    path: `M ${r(source.x)},${r(source.y)} C ${r(c1.x)},${r(c1.y)} ${r(c2.x)},${r(c2.y)} ${r(target.x)},${r(target.y)}`,
    labelX,
    labelY,
  };
}

const isVertical = (side: HandleSide) => side === 'top' || side === 'bottom';

/** Computes the corner points of an orthogonal (step) route. */
export function getStepPoints({ source, sourceSide, target, targetSide }: EdgePathInput, gap = 24): XYPosition[] {
  const sv = sideVector[sourceSide];
  const tv = sideVector[targetSide];
  const p1 = { x: source.x + sv.x * gap, y: source.y + sv.y * gap };
  const p2 = { x: target.x + tv.x * gap, y: target.y + tv.y * gap };
  let middle: XYPosition[];
  if (isVertical(sourceSide) && isVertical(targetSide)) {
    const midY = (p1.y + p2.y) / 2;
    middle = [{ x: p1.x, y: midY }, { x: p2.x, y: midY }];
  } else if (!isVertical(sourceSide) && !isVertical(targetSide)) {
    const midX = (p1.x + p2.x) / 2;
    middle = [{ x: midX, y: p1.y }, { x: midX, y: p2.y }];
  } else if (isVertical(sourceSide)) {
    middle = [{ x: p1.x, y: p2.y }];
  } else {
    middle = [{ x: p2.x, y: p1.y }];
  }
  const points = [source, p1, ...middle, p2, target];
  // Drop duplicate and collinear points so corners can be rounded cleanly.
  const cleaned: XYPosition[] = [];
  for (const p of points) {
    const last = cleaned[cleaned.length - 1];
    if (last && Math.abs(last.x - p.x) < 0.01 && Math.abs(last.y - p.y) < 0.01) continue;
    cleaned.push(p);
  }
  return cleaned.filter((p, i) => {
    const a = cleaned[i - 1];
    const b = cleaned[i + 1];
    if (!a || !b) return true;
    return !((a.x === p.x && p.x === b.x) || (a.y === p.y && p.y === b.y));
  });
}

interface StepSegment {
  from: XYPosition;
  to: XYPosition;
  length: number;
}

function roundedCorner(incoming: StepSegment, outgoing: StepSegment, radius: number): string {
  const { from: prev, to: cur, length: inLen } = incoming;
  const { to: next, length: outLen } = outgoing;
  const rad = Math.min(radius, inLen / 2, outLen / 2);
  const before = { x: cur.x - ((cur.x - prev.x) / inLen) * rad, y: cur.y - ((cur.y - prev.y) / inLen) * rad };
  const after = { x: cur.x + ((next.x - cur.x) / outLen) * rad, y: cur.y + ((next.y - cur.y) / outLen) * rad };
  return ` L ${r(before.x)},${r(before.y)} Q ${r(cur.x)},${r(cur.y)} ${r(after.x)},${r(after.y)}`;
}

function midpointAlong(segments: StepSegment[], start: XYPosition): XYPosition {
  let remaining = segments.reduce((total, segment) => total + segment.length, 0) / 2;
  for (const { from, to, length } of segments) {
    if (remaining <= length) {
      const t = length === 0 ? 0 : remaining / length;
      return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    }
    remaining -= length;
  }
  return start;
}

export function getStepPath(input: EdgePathInput, radius = 10): EdgePath {
  const [first, ...rest] = getStepPoints(input);
  if (!first) return { path: '', labelX: 0, labelY: 0 };
  const segments: StepSegment[] = [];
  let from = first;
  for (const to of rest) {
    segments.push({ from, to, length: Math.hypot(to.x - from.x, to.y - from.y) });
    from = to;
  }
  let d = `M ${r(first.x)},${r(first.y)}`;
  let previous: StepSegment | undefined;
  for (const segment of segments) {
    if (previous) d += roundedCorner(previous, segment, radius);
    previous = segment;
  }
  d += ` L ${r(from.x)},${r(from.y)}`;
  const label = midpointAlong(segments, first);
  return { path: d, labelX: label.x, labelY: label.y };
}

export function getEdgePath(type: EdgePathType, input: EdgePathInput): EdgePath {
  switch (type) {
    case 'straight':
      return getStraightPath(input);
    case 'step':
      return getStepPath(input);
    default:
      return getBezierPath(input);
  }
}

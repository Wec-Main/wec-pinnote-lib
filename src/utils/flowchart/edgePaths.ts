import type { EdgePathType, HandleSide, XYPosition } from "../../types/flowchart.types";
import { clamp, sideVector } from "./geometry";

export interface EdgePathInput {
  source: XYPosition;
  sourceSide: HandleSide;
  target: XYPosition;
  targetSide: HandleSide;
  bend?: number;
}

export type BendAxis = "x" | "y";

export interface StepBend {
  axis: BendAxis;
  value: number;
  handle: XYPosition;
  /** Extent of the bend segment along its own direction. */
  span: [number, number];
}

export interface EdgePath {
  /** SVG path "d" attribute. */
  path: string;
  /** Point where the label is placed. */
  labelX: number;
  labelY: number;
  bend?: StepBend;
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

const isVertical = (side: HandleSide) => side === "top" || side === "bottom";

function stepAnchors({ source, sourceSide, target, targetSide }: EdgePathInput, gap: number) {
  const sv = sideVector[sourceSide];
  const tv = sideVector[targetSide];
  return {
    p1: { x: source.x + sv.x * gap, y: source.y + sv.y * gap },
    p2: { x: target.x + tv.x * gap, y: target.y + tv.y * gap },
  };
}

/** The draggable middle segment of a step route: its axis, position and handle point. */
export function getStepBend(input: EdgePathInput, gap = 24): StepBend {
  const { p1, p2 } = stepAnchors(input, gap);
  const targetVertical = isVertical(input.targetSide);
  if (isVertical(input.sourceSide)) {
    const value = input.bend ?? (targetVertical ? (p1.y + p2.y) / 2 : p2.y);
    return {
      axis: "y",
      value,
      handle: { x: (p1.x + p2.x) / 2, y: value },
      span: [Math.min(p1.x, p2.x), Math.max(p1.x, p2.x)],
    };
  }
  const value = input.bend ?? (targetVertical ? p2.x : (p1.x + p2.x) / 2);
  return {
    axis: "x",
    value,
    handle: { x: value, y: (p1.y + p2.y) / 2 },
    span: [Math.min(p1.y, p2.y), Math.max(p1.y, p2.y)],
  };
}

/** Computes the corner points of an orthogonal (step) route. */
export function getStepPoints(input: EdgePathInput, gap = 24): XYPosition[] {
  const { source, target } = input;
  const { p1, p2 } = stepAnchors(input, gap);
  const bend = getStepBend(input, gap);
  const middle =
    bend.axis === "y"
      ? [
          { x: p1.x, y: bend.value },
          { x: p2.x, y: bend.value },
        ]
      : [
          { x: bend.value, y: p1.y },
          { x: bend.value, y: p2.y },
        ];
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
  const before = {
    x: cur.x - ((cur.x - prev.x) / inLen) * rad,
    y: cur.y - ((cur.y - prev.y) / inLen) * rad,
  };
  const after = {
    x: cur.x + ((next.x - cur.x) / outLen) * rad,
    y: cur.y + ((next.y - cur.y) / outLen) * rad,
  };
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
  if (!first) return { path: "", labelX: 0, labelY: 0 };
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
  return { path: d, labelX: label.x, labelY: label.y, bend: getStepBend(input) };
}

export function getEdgePath(type: EdgePathType, input: EdgePathInput): EdgePath {
  switch (type) {
    case "straight":
      return getStraightPath(input);
    case "step":
      return getStepPath(input);
    default:
      return getBezierPath(input);
  }
}

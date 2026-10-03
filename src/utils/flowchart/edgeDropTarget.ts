import type { Rect, XYPosition } from "../../types/flowchart.types";

export interface EdgeSegment {
  edgeId: string;
  points: XYPosition[];
}

export interface EdgeDropHit {
  edgeId: string;
  distance: number;
  point: XYPosition;
}

export function closestPointOnSegment(
  point: XYPosition,
  a: XYPosition,
  b: XYPosition,
): { point: XYPosition; distance: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  const closest = { x: a.x + t * dx, y: a.y + t * dy };
  return { point: closest, distance: Math.hypot(point.x - closest.x, point.y - closest.y) };
}

function pointInRect(point: XYPosition, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function findEdgeDropTarget(
  point: XYPosition,
  segments: EdgeSegment[],
  nodeRects: Rect[],
  tolerance: number,
): EdgeDropHit | null {
  if (nodeRects.some((rect) => pointInRect(point, rect))) {
    return null;
  }
  let best: EdgeDropHit | null = null;
  for (const segment of segments) {
    for (let i = 1; i < segment.points.length; i += 1) {
      const a = segment.points[i - 1];
      const b = segment.points[i];
      if (!a || !b) continue;
      const hit = closestPointOnSegment(point, a, b);
      if (hit.distance > tolerance) continue;
      if (!best || hit.distance < best.distance) {
        best = { edgeId: segment.edgeId, distance: hit.distance, point: hit.point };
      }
    }
  }
  return best;
}

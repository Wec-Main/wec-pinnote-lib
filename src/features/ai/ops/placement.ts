import type { Dimensions, Rect, XYPosition } from "../../../types/flowchart.types";

export function overlaps(a: Rect, b: Rect, gap: number): boolean {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
}

export function avoidOverlap(
  start: XYPosition,
  size: Dimensions,
  obstacles: readonly Rect[],
  gap: number,
  axis: "x" | "y" = "y",
): XYPosition {
  const position = { ...start };
  for (let i = 0; i <= obstacles.length; i++) {
    const rect = { ...position, ...size };
    const hit = obstacles.find((obstacle) => overlaps(rect, obstacle, gap));
    if (!hit) break;
    if (axis === "y") position.y = hit.y + hit.height + gap;
    else position.x = hit.x + hit.width + gap;
  }
  return position;
}

export function rightMost(rects: readonly Rect[]): Rect | null {
  let best: Rect | null = null;
  for (const rect of rects) {
    if (
      !best ||
      rect.x + rect.width > best.x + best.width ||
      (rect.x + rect.width === best.x + best.width && rect.y < best.y)
    ) {
      best = rect;
    }
  }
  return best;
}

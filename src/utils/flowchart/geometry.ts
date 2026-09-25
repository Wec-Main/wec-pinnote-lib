import type { FlowNode, HandleSide, Rect, Viewport, XYPosition } from "../../types/flowchart.types";
import type { HandleDefinition, NodeTypeDefinition, NodeTypeRegistry } from "./nodeTypes";

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function getNodeSize(node: FlowNode, def: NodeTypeDefinition) {
  return {
    width: node.width ?? def.defaultSize.width,
    height: node.height ?? def.defaultSize.height,
  };
}

export function getNodeRect(node: FlowNode, registry: NodeTypeRegistry): Rect {
  const { width, height } = getNodeSize(node, registry.get(node.type));
  return { x: node.position.x, y: node.position.y, width, height };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function pointInRect(p: XYPosition, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

export function getBounds(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Normalises a rectangle drawn between two arbitrary corner points. */
export function rectFromPoints(a: XYPosition, b: XYPosition): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

export const screenToFlow = (p: XYPosition, v: Viewport): XYPosition => ({
  x: (p.x - v.x) / v.zoom,
  y: (p.y - v.y) / v.zoom,
});

export const flowToScreen = (p: XYPosition, v: Viewport): XYPosition => ({
  x: p.x * v.zoom + v.x,
  y: p.y * v.zoom + v.y,
});

export const snapPosition = (p: XYPosition, grid: number): XYPosition => ({
  x: Math.round(p.x / grid) * grid,
  y: Math.round(p.y / grid) * grid,
});

/** Horizontal inset of a parallelogram's slanted sides. */
export const parallelogramSkew = (width: number) => Math.min(24, width * 0.12);

/**
 * Position of a handle relative to its node's top-left corner. Handles that
 * share a side are distributed evenly along it.
 */
export function getHandleOffset(
  def: NodeTypeDefinition,
  handle: HandleDefinition,
  width: number,
  height: number,
): XYPosition {
  const siblings = def.handles.filter((h) => h.side === handle.side);
  const t = (siblings.indexOf(handle) + 1) / (siblings.length + 1);
  const skew = def.shape === "parallelogram" ? parallelogramSkew(width) / 2 : 0;
  switch (handle.side) {
    case "top":
      return { x: width * t, y: 0 };
    case "bottom":
      return { x: width * t, y: height };
    case "left":
      return { x: skew, y: height * t };
    case "right":
      return { x: width - skew, y: height * t };
  }
}

export function getHandlePosition(
  node: FlowNode,
  def: NodeTypeDefinition,
  handle: HandleDefinition,
): XYPosition {
  const { width, height } = getNodeSize(node, def);
  const offset = getHandleOffset(def, handle, width, height);
  return { x: node.position.x + offset.x, y: node.position.y + offset.y };
}

/** Resolves a handle by id, or the first handle of the requested kind. */
export function findHandle(
  def: NodeTypeDefinition,
  kind: HandleDefinition["kind"],
  id?: string,
): HandleDefinition | undefined {
  if (id) return def.handles.find((h) => h.id === id && h.kind === kind);
  return def.handles.find((h) => h.kind === kind);
}

export const sideVector: Record<HandleSide, XYPosition> = {
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const oppositeSide: Record<HandleSide, HandleSide> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

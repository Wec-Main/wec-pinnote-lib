import type { AnnotationAnchor } from "../types/annotation.types";
import { resolveElement } from "./elementResolver";

export interface PinScreenPosition {
  x: number;
  y: number;
  resolved: boolean;
}

export type PanelSide = "right" | "left" | "bottom" | "top";

export interface PanelPlacement {
  left: number;
  top: number;
  side: PanelSide;
}

const GAP = 16;
const VIEWPORT_PADDING = 16;
const TOP_SAFE = 72;

export function computePinPosition(
  anchor: AnnotationAnchor,
  element: Element | null = resolveElement(anchor),
): PinScreenPosition {
  if (element) {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + anchor.relativeX * rect.width,
      y: rect.top + anchor.relativeY * rect.height,
      resolved: true,
    };
  }

  return {
    x: anchor.fallbackX,
    y: anchor.fallbackY,
    resolved: false,
  };
}

export function placePanel(
  anchorX: number,
  anchorY: number,
  panelWidth: number,
  panelHeight: number,
  viewportWidth: number = window.innerWidth,
  viewportHeight: number = window.innerHeight,
): PanelPlacement {
  const rightSpace = viewportWidth - anchorX;
  const leftSpace = anchorX;
  const bottomSpace = viewportHeight - anchorY;
  const topSpace = anchorY;

  let side: PanelSide = "right";
  if (rightSpace >= panelWidth + GAP + VIEWPORT_PADDING) {
    side = "right";
  } else if (leftSpace >= panelWidth + GAP + VIEWPORT_PADDING) {
    side = "left";
  } else if (bottomSpace >= panelHeight + GAP + VIEWPORT_PADDING) {
    side = "bottom";
  } else if (topSpace >= panelHeight + GAP + VIEWPORT_PADDING) {
    side = "top";
  } else {
    side = rightSpace >= leftSpace ? "right" : "left";
  }

  let left =
    side === "right"
      ? anchorX + GAP
      : side === "left"
        ? anchorX - panelWidth - GAP
        : anchorX - panelWidth / 2;
  let top =
    side === "bottom"
      ? anchorY + GAP
      : side === "top"
        ? anchorY - panelHeight - GAP
        : anchorY - 20;

  left = Math.max(VIEWPORT_PADDING, Math.min(left, viewportWidth - panelWidth - VIEWPORT_PADDING));
  top = Math.max(TOP_SAFE, Math.min(top, viewportHeight - panelHeight - VIEWPORT_PADDING));

  return { left, top, side };
}

export function positionsEqual(a: PinScreenPosition, b: PinScreenPosition): boolean {
  return a.x === b.x && a.y === b.y && a.resolved === b.resolved;
}

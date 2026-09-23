import { useLayoutEffect, useState, type RefObject } from "react";

export type FloatingPlacement = "bottom-start" | "right-start";

interface FloatingPositionResult {
  top: number;
  left: number;
}

const VIEWPORT_MARGIN = 8;

function measure(
  anchor: HTMLElement,
  panel: HTMLElement,
  placement: FloatingPlacement,
): FloatingPositionResult {
  const anchorRect = anchor.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (placement === "right-start") {
    const fitsRight = anchorRect.right + panelRect.width <= viewportWidth - VIEWPORT_MARGIN;
    const left = fitsRight
      ? anchorRect.right
      : Math.max(VIEWPORT_MARGIN, anchorRect.left - panelRect.width);
    const fitsBelow = anchorRect.top + panelRect.height <= viewportHeight - VIEWPORT_MARGIN;
    const top = fitsBelow
      ? anchorRect.top
      : Math.max(VIEWPORT_MARGIN, viewportHeight - VIEWPORT_MARGIN - panelRect.height);
    return { top, left };
  }

  const fitsBelow = anchorRect.bottom + panelRect.height <= viewportHeight - VIEWPORT_MARGIN;
  const top = fitsBelow
    ? anchorRect.bottom
    : Math.max(VIEWPORT_MARGIN, anchorRect.top - panelRect.height);
  const fitsLeftAligned = anchorRect.left + panelRect.width <= viewportWidth - VIEWPORT_MARGIN;
  const left = fitsLeftAligned
    ? anchorRect.left
    : Math.max(VIEWPORT_MARGIN, anchorRect.right - panelRect.width);
  return { top, left };
}

export function useFloatingPosition(
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  open: boolean,
  placement: FloatingPlacement = "bottom-start",
): FloatingPositionResult | null {
  const [position, setPosition] = useState<FloatingPositionResult | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) {
      return;
    }
    setPosition(measure(anchor, panel, placement));
  }, [open, placement, anchorRef, panelRef]);

  return position;
}

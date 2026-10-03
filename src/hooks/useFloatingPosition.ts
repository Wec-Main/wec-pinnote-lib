import { useLayoutEffect, useState, type RefObject } from "react";

export type FloatingPlacement = "bottom-start" | "right-start";

interface FloatingPositionResult {
  top: number;
  left: number;
}

const VIEWPORT_MARGIN = 8;

function measureAtContainingBlockOrigin(panel: HTMLElement) {
  const previousTop = panel.style.top;
  const previousLeft = panel.style.left;
  panel.style.top = "0px";
  panel.style.left = "0px";
  const rect = panel.getBoundingClientRect();
  panel.style.top = previousTop;
  panel.style.left = previousLeft;
  return rect;
}

function measure(
  anchor: HTMLElement,
  panel: HTMLElement,
  placement: FloatingPlacement,
): FloatingPositionResult {
  const anchorRect = anchor.getBoundingClientRect();
  const panelRect = measureAtContainingBlockOrigin(panel);
  const originX = panelRect.left;
  const originY = panelRect.top;
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
    return { top: top - originY, left: left - originX };
  }

  const spaceBelow = viewportHeight - VIEWPORT_MARGIN - anchorRect.bottom;
  const spaceAbove = anchorRect.top - VIEWPORT_MARGIN;
  const openBelow = panelRect.height <= spaceBelow || spaceBelow >= spaceAbove;
  const top = openBelow
    ? Math.min(anchorRect.bottom, viewportHeight - VIEWPORT_MARGIN - panelRect.height)
    : Math.max(VIEWPORT_MARGIN, anchorRect.top - panelRect.height);
  const fitsLeftAligned = anchorRect.left + panelRect.width <= viewportWidth - VIEWPORT_MARGIN;
  const left = fitsLeftAligned
    ? anchorRect.left
    : Math.max(VIEWPORT_MARGIN, anchorRect.right - panelRect.width);
  return { top: Math.max(VIEWPORT_MARGIN, top) - originY, left: left - originX };
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
    const update = () => setPosition(measure(anchor, panel, placement));
    update();
    window.addEventListener("resize", update);

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(panel);

    return () => {
      window.removeEventListener("resize", update);
      resizeObserver.disconnect();
    };
  }, [open, placement, anchorRef, panelRef]);

  return position;
}

import { useEffect, useMemo, useState, type RefObject } from "react";
import type { AnnotationAnchor } from "../types/annotation.types";
import { resolveElement } from "../utils/elementResolver";
import {
  computePinPosition,
  placePanel,
  positionsEqual,
  type PinScreenPosition,
} from "../utils/positioning";

export interface PositionedItem {
  id: string;
  anchor: AnnotationAnchor;
}

function mapsEqual(
  left: Map<string, PinScreenPosition>,
  right: Map<string, PinScreenPosition>,
): boolean {
  if (left.size !== right.size) {
    return false;
  }
  for (const [id, position] of right) {
    const previous = left.get(id);
    if (!previous || !positionsEqual(previous, position)) {
      return false;
    }
  }
  return true;
}

export function useAnnotationPositions(
  items: PositionedItem[],
): Map<string, PinScreenPosition> {
  const [positions, setPositions] = useState<Map<string, PinScreenPosition>>(() => new Map());
  const itemsKey = useMemo(
    () => items.map((item) => `${item.id}:${item.anchor.selector}`).join("|"),
    [items],
  );

  useEffect(() => {
    let frame = 0;
    let scheduled = false;

    const compute = () => {
      scheduled = false;
      const next = new Map<string, PinScreenPosition>();
      for (const item of items) {
        next.set(item.id, computePinPosition(item.anchor, resolveElement(item.anchor)));
      }
      setPositions((current) => (mapsEqual(current, next) ? current : next));
    };

    const schedule = () => {
      if (scheduled) {
        return;
      }
      scheduled = true;
      frame = window.requestAnimationFrame(compute);
    };

    schedule();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { capture: true, passive: true });

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    resizeObserver?.observe(document.documentElement);

    for (const item of items) {
      const element = resolveElement(item.anchor);
      if (element) {
        resizeObserver?.observe(element);
        let ancestor = element.parentElement;
        while (ancestor) {
          resizeObserver?.observe(ancestor);
          ancestor = ancestor.parentElement;
        }
      }
    }

    const mutationObserver =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(schedule);
    mutationObserver?.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden"],
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [items, itemsKey]);

  return positions;
}

export function useFloatingPanel(
  open: boolean,
  anchorX: number,
  anchorY: number,
  panelRef: RefObject<HTMLElement | null>,
): { left: number; top: number; side: string } {
  const [placement, setPlacement] = useState({ left: 0, top: 0, side: "right" });

  useEffect(() => {
    if (!open) {
      return;
    }

    let frame = 0;

    const update = () => {
      const panel = panelRef.current;
      if (!panel) {
        return;
      }
      const next = placePanel(anchorX, anchorY, panel.offsetWidth, panel.offsetHeight);
      setPlacement((current) =>
        current.left === next.left && current.top === next.top && current.side === next.side
          ? current
          : next,
      );
    };

    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };

    schedule();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { capture: true, passive: true });

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    if (panelRef.current) {
      observer?.observe(panelRef.current);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      observer?.disconnect();
    };
  }, [anchorX, anchorY, open, panelRef]);

  return placement;
}

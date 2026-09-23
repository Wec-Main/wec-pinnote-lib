import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
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

const MUTATION_DEBOUNCE_MS = 120;
const MUTATION_MAX_WAIT_MS = 400;
const LIBRARY_ROOT_SELECTOR = ".wpn-root";

function isLibraryElement(node: Node): boolean {
  return node instanceof Element && node.closest(LIBRARY_ROOT_SELECTOR) !== null;
}

function resolveTargets(items: PositionedItem[]): Map<string, Element | null> {
  const resolved = new Map<string, Element | null>();
  for (const item of items) {
    resolved.set(item.id, resolveElement(item.anchor));
  }
  return resolved;
}

function collectObservationTargets(resolved: Map<string, Element | null>): Element[] {
  const targets: Element[] = [];
  for (const element of resolved.values()) {
    if (!element) {
      continue;
    }
    targets.push(element);
    let ancestor = element.parentElement;
    while (ancestor) {
      targets.push(ancestor);
      ancestor = ancestor.parentElement;
    }
  }
  return targets;
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

function anchorKey(anchor: AnnotationAnchor): string {
  return [
    anchor.selector,
    anchor.elementIdentifier,
    anchor.relativeX,
    anchor.relativeY,
    anchor.fallbackX,
    anchor.fallbackY,
    anchor.viewportWidth,
    anchor.viewportHeight,
  ].join(":");
}

export function useAnnotationPositions(items: PositionedItem[]): Map<string, PinScreenPosition> {
  const [positions, setPositions] = useState<Map<string, PinScreenPosition>>(() => new Map());
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const itemsKey = useMemo(
    () => items.map((item) => `${item.id}:${anchorKey(item.anchor)}`).join("|"),
    [items],
  );

  useEffect(() => {
    const items = itemsRef.current;
    let frame = 0;
    let scheduled = false;
    let debounceTimer = 0;
    let maxWaitTimer = 0;
    const resolved = resolveTargets(items);

    const compute = () => {
      scheduled = false;
      window.clearTimeout(maxWaitTimer);
      maxWaitTimer = 0;
      const next = new Map<string, PinScreenPosition>();
      for (const item of items) {
        next.set(item.id, computePinPosition(item.anchor, resolved.get(item.id) ?? null));
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

    const scheduleDebounced = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(schedule, MUTATION_DEBOUNCE_MS);
      if (!maxWaitTimer) {
        maxWaitTimer = window.setTimeout(schedule, MUTATION_MAX_WAIT_MS);
      }
    };

    schedule();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { capture: true, passive: true });

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    resizeObserver?.observe(document.documentElement);

    const observationTargets = collectObservationTargets(resolved);
    for (const target of observationTargets) {
      resizeObserver?.observe(target);
    }

    const mutationObserver =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver((mutations) => {
            const relevant = mutations.some((mutation) => !isLibraryElement(mutation.target));
            if (relevant) {
              scheduleDebounced();
            }
          });
    for (const target of observationTargets) {
      mutationObserver?.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class", "hidden"],
      });
    }

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(debounceTimer);
      window.clearTimeout(maxWaitTimer);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [itemsKey]);

  return positions;
}

export function useFloatingPanel(
  open: boolean,
  anchorX: number,
  anchorY: number,
  panelRef: RefObject<HTMLElement | null>,
): { left: number; top: number; side: string } {
  const [placement, setPlacement] = useState({ left: 0, top: 0, side: "right" });
  const anchorXRef = useRef(anchorX);
  const anchorYRef = useRef(anchorY);
  const scheduleRef = useRef<(() => void) | null>(null);
  anchorXRef.current = anchorX;
  anchorYRef.current = anchorY;

  useEffect(() => {
    scheduleRef.current?.();
  }, [anchorX, anchorY]);

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
      const next = placePanel(
        anchorXRef.current,
        anchorYRef.current,
        panel.offsetWidth,
        panel.offsetHeight,
      );
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
    scheduleRef.current = schedule;

    schedule();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { capture: true, passive: true });

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    if (panelRef.current) {
      observer?.observe(panelRef.current);
    }

    return () => {
      scheduleRef.current = null;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      observer?.disconnect();
    };
  }, [open, panelRef]);

  return placement;
}

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { AnnotationAnchor } from "../types/annotation.types";
import { isLibraryElement, resolveElement } from "../utils/elementResolver";
import { ANNOTATION_SCOPE_ATTRIBUTE } from "../utils/annotationScope";
import {
  computePinPosition,
  placePanel,
  positionsEqual,
  type PanelPlacement,
  type PinScreenPosition,
} from "../utils/positioning";

export interface PositionedItem {
  id: string;
  anchor: AnnotationAnchor;
}

const MUTATION_DEBOUNCE_MS = 120;
const MUTATION_MAX_WAIT_MS = 400;

// A modal typically dims its whole backdrop with a large, translucent scrim
// (covering the full viewport, or close to it) behind an opaque card. That
// scrim shouldn't count as "covering" a pin on its own — a pin sitting on the
// dimmed backdrop, away from the actual dialog card, is still visible to the
// user and not actually obstructed. Only a near-opaque element should count
// as truly blocking. CSS `opacity` dims everything an element paints
// (including its own background fill), so the two combine multiplicatively.
const OPAQUE_ALPHA_THRESHOLD = 0.9;

function effectiveAlpha(element: Element): number {
  const style = window.getComputedStyle(element);
  const opacity = Number.parseFloat(style.opacity || "1") || 1;
  const backgroundColor = style.backgroundColor;
  if (backgroundColor === "transparent") {
    return 0;
  }
  const match = /rgba?\([^)]*?(?:,\s*([\d.]+)\s*)?\)/.exec(backgroundColor);
  const backgroundAlpha = !match || match[1] === undefined ? 1 : Number.parseFloat(match[1]);
  return opacity * backgroundAlpha;
}

// A host app can render its own dialog on top of an annotated page at any
// time, anywhere in the DOM (typically portaled to document.body, not
// nested under the anchor). elementsFromPoint gives the real paint-order
// stack at that pixel, which is the only reliable way to tell "is our pin's
// anchor actually still on top here" regardless of the host's own z-index.
function isCoveredByForeignElement(x: number, y: number, anchor: Element | null): boolean {
  const stack = document.elementsFromPoint(x, y);
  for (const element of stack) {
    if (isLibraryElement(element)) {
      continue;
    }
    if (anchor && (anchor === element || anchor.contains(element) || element.contains(anchor))) {
      return false;
    }
    if (effectiveAlpha(element) < OPAQUE_ALPHA_THRESHOLD) {
      continue;
    }
    return true;
  }
  return !anchor;
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

    // Re-resolve anchors to live elements on every compute, rather than once
    // up front: a host can unmount and remount the DOM behind an anchor (e.g.
    // closing and reopening a dialog re-creates its inputs/buttons as brand
    // new nodes). A cached one-time resolution would keep pointing at the
    // old, now-detached element forever — getBoundingClientRect() on a
    // detached node returns an all-zero rect, which both misplaces the pin
    // and makes it look "covered" (nothing relates it to anything at 0,0).
    const compute = () => {
      scheduled = false;
      window.clearTimeout(maxWaitTimer);
      maxWaitTimer = 0;
      const resolved = resolveTargets(items);
      const next = new Map<string, PinScreenPosition>();
      for (const item of items) {
        const anchorElement = resolved.get(item.id) ?? null;
        const position = computePinPosition(item.anchor, anchorElement);
        next.set(item.id, {
          ...position,
          covered: isCoveredByForeignElement(position.x, position.y, anchorElement),
        });
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

    const scheduleFromTransitionEvent = (event: Event) => {
      if (!isLibraryElement(event.target)) {
        schedule();
      }
    };

    schedule();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    document.addEventListener("transitionend", scheduleFromTransitionEvent, true);
    document.addEventListener("animationend", scheduleFromTransitionEvent, true);

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    resizeObserver?.observe(document.documentElement);

    // Only used to pick which nodes to watch for fine-grained resize/mutation
    // signals below — compute() above never relies on this snapshot itself,
    // so it going stale after a remount just means those specific observers
    // go quiet; the document.body observer further down still catches it.
    const observationTargets = collectObservationTargets(resolveTargets(items));
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
        attributeFilter: ["style", "class", "hidden", ANNOTATION_SCOPE_ATTRIBUTE],
      });
    }
    // A host dialog is usually mounted somewhere in document.body that isn't
    // an ancestor of any anchor (e.g. a portal appended near the end of
    // body), so the anchor-scoped observers above would never see it appear.
    // Watch the whole body too, so opening/closing a host dialog anywhere
    // re-runs the occlusion check above. Re-observing document.body replaces
    // (rather than merges with) any options the loop above already set for
    // it, so this uses the same full option set to avoid silently dropping
    // attribute watching on body (a common place for a host to toggle a
    // "modal open" class).
    mutationObserver?.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden", ANNOTATION_SCOPE_ATTRIBUTE],
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(debounceTimer);
      window.clearTimeout(maxWaitTimer);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      document.removeEventListener("transitionend", scheduleFromTransitionEvent, true);
      document.removeEventListener("animationend", scheduleFromTransitionEvent, true);
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
): PanelPlacement | null {
  const [placement, setPlacement] = useState<PanelPlacement | null>(null);
  const anchorXRef = useRef(anchorX);
  const anchorYRef = useRef(anchorY);
  const scheduleRef = useRef<(() => void) | null>(null);
  anchorXRef.current = anchorX;
  anchorYRef.current = anchorY;

  useLayoutEffect(() => {
    scheduleRef.current?.();
  }, [anchorX, anchorY]);

  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
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
        current &&
        current.left === next.left &&
        current.top === next.top &&
        current.side === next.side
          ? current
          : next,
      );
    };

    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };
    scheduleRef.current = schedule;

    // Synchronous on the very first measurement (before paint, unlike the
    // rAF-deferred schedule() below) so the panel's initial position is
    // already correct on its first painted frame — never a visible flash at
    // the (0,0)/hidden fallback. Later updates (resize/scroll/mutation) go
    // through the throttled schedule() instead, which is fine since the
    // panel is already visibly positioned by then.
    update();
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

import type { AnnotationAnchor } from "../types/annotation.types";
import { generateSelector, isStableId } from "./selectorGenerator";
import { getElementLabel } from "./elementResolver";

const SKIP_TAGS = new Set(["HTML", "BODY", "HEAD", "SCRIPT", "STYLE", "LINK", "META", "NOSCRIPT"]);

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0.5;
  }
  return Math.min(1, Math.max(0, value));
}

// How many ancestor levels the plain-`id` rescue (below) is allowed to climb.
// `data-annotation-id` is an explicit, host-authored opt-in marker, so that
// climb stays unbounded. A bare `id`, though, is ambient — nearly every app
// wraps itself in something like `<div id="root">`, and without a limit this
// climb would walk all the way up to that shell and annotate the whole page.
const STABLE_ID_CLIMB_LIMIT = 3;

export function findAnnotatableElement(start: Element): Element {
  let current: Element | null = start;
  while (current && !SKIP_TAGS.has(current.tagName)) {
    if (current instanceof HTMLElement && current.dataset.annotationId) {
      return current;
    }
    current = current.parentElement;
  }

  current = start;
  let hops = 0;
  while (current && !SKIP_TAGS.has(current.tagName) && hops <= STABLE_ID_CLIMB_LIMIT) {
    if (current.id && isStableId(current.id)) {
      return current;
    }
    current = current.parentElement;
    hops += 1;
  }

  return start;
}

export function createElementAnchor(
  element: Element,
  clientX: number,
  clientY: number,
): AnnotationAnchor {
  const target = findAnnotatableElement(element);
  const rect = target.getBoundingClientRect();
  const { selector, elementIdentifier } = generateSelector(target);
  const width = rect.width || 1;
  const height = rect.height || 1;

  return {
    selector,
    elementIdentifier: elementIdentifier || getElementLabel(target),
    relativeX: clamp01((clientX - rect.left) / width),
    relativeY: clamp01((clientY - rect.top) / height),
    fallbackX: clientX,
    fallbackY: clientY,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
}

export function isAnnotatableTarget(target: EventTarget | null): target is Element {
  return target instanceof Element && !SKIP_TAGS.has(target.tagName);
}

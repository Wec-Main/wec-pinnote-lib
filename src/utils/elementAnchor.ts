import type { AnnotationAnchor } from "../types/annotation.types";
import { generateSelector, isStableId } from "./selectorGenerator";
import { getElementLabel } from "./elementResolver";
import { ANNOTATION_SCOPE_ATTRIBUTE, scopeRootOf } from "./annotationScope";

const SKIP_TAGS = new Set(["HTML", "BODY", "HEAD", "SCRIPT", "STYLE", "LINK", "META", "NOSCRIPT"]);

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0.5;
  }
  return Math.min(1, Math.max(0, value));
}

const STABLE_ID_CLIMB_LIMIT = 3;

export function findAnnotatableElement(start: Element): Element {
  const scopeRoot = scopeRootOf(start);

  let current: Element | null = start;
  while (current && !SKIP_TAGS.has(current.tagName) && current !== scopeRoot) {
    if (current instanceof HTMLElement && current.dataset.annotationId) {
      return current;
    }
    current = current.parentElement;
  }

  current = start;
  let hops = 0;
  while (
    current &&
    !SKIP_TAGS.has(current.tagName) &&
    current !== scopeRoot &&
    hops <= STABLE_ID_CLIMB_LIMIT
  ) {
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
  const scopeRoot = scopeRootOf(target);
  const scopeName = scopeRoot?.getAttribute(ANNOTATION_SCOPE_ATTRIBUTE);
  const { selector, elementIdentifier } = generateSelector(
    target,
    scopeRoot && scopeName ? { name: scopeName, root: scopeRoot } : undefined,
  );
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

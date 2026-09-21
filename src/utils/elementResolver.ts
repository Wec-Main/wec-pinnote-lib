import type { AnnotationAnchor } from "../types/annotation.types";
import { cssEscape } from "./selectorGenerator";

const LIBRARY_ROOT_CLASS = "wpn-root";

export function isLibraryElement(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(`.${LIBRARY_ROOT_CLASS}`));
}

export function resolveElement(anchor: AnnotationAnchor): Element | null {
  if (anchor.selector) {
    try {
      const bySelector = document.querySelector(anchor.selector);
      if (bySelector) {
        return bySelector;
      }
    } catch {
      // Invalid selectors fall through to identifier lookup.
    }
  }

  if (anchor.elementIdentifier) {
    const byAnnotationId = document.querySelector(
      `[data-annotation-id="${cssEscape(anchor.elementIdentifier)}"]`,
    );
    if (byAnnotationId) {
      return byAnnotationId;
    }

    if (typeof CSS !== "undefined") {
      const byId = document.getElementById(anchor.elementIdentifier);
      if (byId) {
        return byId;
      }
    }
  }

  return null;
}

export function getElementLabel(element: Element): string {
  if (!(element instanceof HTMLElement)) {
    return element.tagName.toLowerCase();
  }

  const annotationId = element.dataset.annotationId;
  if (annotationId) {
    return annotationId.replace(/[-_]/g, " ");
  }

  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) {
    return ariaLabel;
  }

  if (element instanceof HTMLInputElement) {
    return element.placeholder || element.name || element.type || "input";
  }

  const text = element.textContent?.trim();
  if (text) {
    return text.length > 48 ? `${text.slice(0, 45)}...` : text;
  }

  return element.tagName.toLowerCase();
}

import type { AnnotationAnchor } from "../types/annotation.types";
import { cssEscape } from "./selectorGenerator";
import { activeScopeRoot, findScopeRoot, isRendered, parseScopedSelector } from "./annotationScope";

const LIBRARY_ROOT_CLASS = "wpn-root";
const LABELABLE_SELECTOR =
  "input, textarea, select, button, a, [role], [aria-label], h1, h2, h3, h4, h5, h6, label, p, span";

export function isLibraryElement(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(`.${LIBRARY_ROOT_CLASS}`));
}

function dropNestedDuplicates(candidates: Element[]): Element[] {
  return candidates.filter(
    (candidate) => !candidates.some((other) => other !== candidate && other.contains(candidate)),
  );
}

function pickAmong(candidates: Element[], label: string): Element | null {
  const deduped = dropNestedDuplicates(candidates);

  if (deduped.length === 1) {
    return deduped[0] ?? null;
  }

  const rendered = deduped.filter(isRendered);
  if (rendered.length === 1) {
    return rendered[0] ?? null;
  }

  const labelMatches = (rendered.length > 0 ? rendered : deduped).filter(
    (candidate) => getElementLabel(candidate) === label,
  );
  if (labelMatches.length === 1) {
    return labelMatches[0] ?? null;
  }

  return null;
}

function findByLabel(label: string, root: ParentNode): Element | null {
  const candidates = Array.from(root.querySelectorAll(LABELABLE_SELECTOR)).filter((candidate) => {
    if (isLibraryElement(candidate)) {
      return false;
    }
    if (label === candidate.tagName.toLowerCase()) {
      return false;
    }
    return getElementLabel(candidate) === label;
  });

  const deduped = dropNestedDuplicates(candidates);
  if (deduped.length === 0) {
    return null;
  }
  if (deduped.length === 1) {
    return deduped[0] ?? null;
  }
  return pickAmong(deduped, label);
}

export function resolveElement(anchor: AnnotationAnchor): Element | null {
  const active = activeScopeRoot(document);
  const { scope, inner } = parseScopedSelector(anchor.selector);

  if (scope) {
    if (!active || active !== findScopeRoot(scope)) {
      return null;
    }
    return resolveWithin(inner, active, anchor.elementIdentifier);
  }

  if (active) {
    return null;
  }

  return resolveWithin(inner, document, anchor.elementIdentifier);
}

function resolveWithin(selector: string, root: ParentNode, elementIdentifier: string): Element | null {
  if (selector) {
    try {
      const matches = Array.from(root.querySelectorAll(selector));
      if (matches.length === 1) {
        return matches[0] ?? null;
      }
      if (matches.length > 1) {
        const picked = pickAmong(matches, elementIdentifier);
        if (picked) {
          return picked;
        }
      }
    } catch {
      // A stored selector can be invalid CSS; fall through to the other strategies.
    }
  }

  if (elementIdentifier) {
    const byAnnotationId = root.querySelectorAll(
      `[data-annotation-id="${cssEscape(elementIdentifier)}"]`,
    );
    if (byAnnotationId.length === 1) {
      return byAnnotationId[0] ?? null;
    }
    if (byAnnotationId.length > 1) {
      const picked = pickAmong(Array.from(byAnnotationId), elementIdentifier);
      if (picked) {
        return picked;
      }
    }

    if (root instanceof Document) {
      const byId = root.getElementById(elementIdentifier);
      if (byId) {
        return byId;
      }
    }

    const byLabel = findByLabel(elementIdentifier, root);
    if (byLabel) {
      return byLabel;
    }
  }

  return null;
}

function getAssociatedLabelText(element: HTMLElement): string | null {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    const text = element.labels?.[0]?.textContent?.trim();
    if (text) {
      return text;
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

  const associatedLabel = getAssociatedLabelText(element);
  if (associatedLabel) {
    return associatedLabel;
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

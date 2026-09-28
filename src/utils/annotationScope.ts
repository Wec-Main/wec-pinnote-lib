export const ANNOTATION_SCOPE_ATTRIBUTE = "data-annotation-scope";

const LIBRARY_ROOT_CLASS = "wpn-root";
const SCOPE_SELECTOR = `[${ANNOTATION_SCOPE_ATTRIBUTE}]`;
const SCOPE_PREFIX = "@scope:";

export function scopeRootOf(element: Element): Element | null {
  let current: Element | null = element;
  while (current) {
    if (current.classList.contains(LIBRARY_ROOT_CLASS)) {
      return null;
    }
    if (current.hasAttribute(ANNOTATION_SCOPE_ATTRIBUTE)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

export function scopedSelector(name: string, inner: string): string {
  return `${SCOPE_PREFIX}${encodeURIComponent(name)}:${inner}`;
}

export function parseScopedSelector(selector: string): { scope: string | null; inner: string } {
  if (!selector.startsWith(SCOPE_PREFIX)) {
    return { scope: null, inner: selector };
  }
  const rest = selector.slice(SCOPE_PREFIX.length);
  const separatorIndex = rest.indexOf(":");
  if (separatorIndex === -1) {
    return { scope: null, inner: selector };
  }
  return {
    scope: decodeURIComponent(rest.slice(0, separatorIndex)),
    inner: rest.slice(separatorIndex + 1),
  };
}

export function isRendered(element: Element): boolean {
  if (element instanceof HTMLElement && element.hidden) {
    return false;
  }
  let current: Element | null = element;
  while (current) {
    const style = getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    current = current.parentElement;
  }
  return true;
}

export function activeScopeRoot(doc: Document): Element | null {
  const candidates = Array.from(doc.querySelectorAll(SCOPE_SELECTOR));
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index];
    if (candidate && isRendered(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function findScopeRoot(name: string, doc: Document = document): Element | null {
  return doc.querySelector(`[${ANNOTATION_SCOPE_ATTRIBUTE}="${CSS.escape(name)}"]`);
}

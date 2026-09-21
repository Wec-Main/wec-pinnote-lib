const UNSTABLE_ID_PATTERNS = [
  /^:/,
  /^ember\d+/i,
  /^react-select/i,
  /^:r[0-9a-z]+/i,
  /^[a-f0-9]{8,}$/i,
];

const STABLE_DATA_KEYS = ["annotation-id", "name", "field"];

const SKIP_TAGS = new Set(["HTML", "BODY", "HEAD", "SCRIPT", "STYLE", "LINK", "META", "NOSCRIPT"]);

export function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

export function isStableId(id: string): boolean {
  if (!id) {
    return false;
  }
  return !UNSTABLE_ID_PATTERNS.some((pattern) => pattern.test(id));
}

export function isUniqueSelector(selector: string, root: ParentNode = document): boolean {
  try {
    return root.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

function dataAttributeSelector(element: Element, key: string): string | null {
  const value = element.getAttribute(`data-${key}`);
  if (!value) {
    return null;
  }
  return `[data-${key}="${cssEscape(value)}"]`;
}

function attributeSelector(element: Element, name: string): string | null {
  const value = element.getAttribute(name);
  if (!value) {
    return null;
  }
  return `${element.tagName.toLowerCase()}[${name}="${cssEscape(value)}"]`;
}

function generatedPathSelector(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && !SKIP_TAGS.has(current.tagName)) {
    const annotationId = dataAttributeSelector(current, "annotation-id");
    if (annotationId && isUniqueSelector(annotationId)) {
      parts.unshift(annotationId);
      break;
    }

    if (current.id && isStableId(current.id)) {
      const idSelector = `#${cssEscape(current.id)}`;
      if (isUniqueSelector(idSelector)) {
        parts.unshift(idSelector);
        break;
      }
    }

    const node: Element = current;
    const tag = node.tagName.toLowerCase();
    const parent: Element | null = node.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }

    const sameTagSiblings = Array.from(parent.children).filter(
      (child) => child.tagName === node.tagName,
    );
    if (sameTagSiblings.length === 1) {
      parts.unshift(tag);
    } else {
      const index = sameTagSiblings.indexOf(node) + 1;
      parts.unshift(`${tag}:nth-of-type(${index})`);
    }

    current = parent;
  }

  return parts.join(" > ");
}

export function generateSelector(element: Element): { selector: string; elementIdentifier: string } {
  const annotationId = element.getAttribute("data-annotation-id");
  if (annotationId) {
    const selector = `[data-annotation-id="${cssEscape(annotationId)}"]`;
    if (isUniqueSelector(selector)) {
      return { selector, elementIdentifier: annotationId };
    }
  }

  if (element.id && isStableId(element.id)) {
    const selector = `#${cssEscape(element.id)}`;
    if (isUniqueSelector(selector)) {
      return { selector, elementIdentifier: element.id };
    }
  }

  for (const key of STABLE_DATA_KEYS) {
    const selector = dataAttributeSelector(element, key);
    if (selector && isUniqueSelector(selector)) {
      return {
        selector,
        elementIdentifier: element.getAttribute(`data-${key}`) ?? selector,
      };
    }
  }

  const nameSelector = attributeSelector(element, "name");
  if (nameSelector && isUniqueSelector(nameSelector)) {
    return {
      selector: nameSelector,
      elementIdentifier: element.getAttribute("name") ?? nameSelector,
    };
  }

  const ariaSelector = attributeSelector(element, "aria-label");
  if (ariaSelector && isUniqueSelector(ariaSelector)) {
    return {
      selector: ariaSelector,
      elementIdentifier: element.getAttribute("aria-label") ?? ariaSelector,
    };
  }

  const type = element.getAttribute("type");
  const name = element.getAttribute("name");
  if (type && name) {
    const combined = `${element.tagName.toLowerCase()}[type="${cssEscape(type)}"][name="${cssEscape(name)}"]`;
    if (isUniqueSelector(combined)) {
      return { selector: combined, elementIdentifier: name };
    }
  }

  const selector = generatedPathSelector(element);
  return {
    selector,
    elementIdentifier: annotationId ?? element.id ?? selector,
  };
}

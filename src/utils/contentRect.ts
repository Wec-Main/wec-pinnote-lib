export function measureContentRect(element: Element): DOMRect | null {
  try {
    const range = document.createRange();
    range.selectNodeContents(element);
    const rect = range.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    return rect;
  } catch {
    return null;
  }
}

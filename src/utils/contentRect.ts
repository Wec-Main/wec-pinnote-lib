// Measures the tight bounding box of an element's rendered text content,
// rather than its own border box. A block-level element's box can be wider
// than its content (e.g. a heading centered/left-aligned within a wider
// container) — text-align/justify-content shifts where the glyphs sit
// *inside* the box without necessarily changing the box itself. A Range
// over the element's contents reports the glyphs' actual current position,
// so re-measuring it naturally follows an alignment change the same way
// re-measuring getBoundingClientRect() follows the box moving.
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

export interface CaretPosition {
  left: number;
  top: number;
  lineHeight: number;
}

const MIRRORED_PROPERTIES = [
  "box-sizing",
  "width",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-style",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "letter-spacing",
  "line-height",
  "text-transform",
  "word-spacing",
  "tab-size",
];

const LINE_HEIGHT_FALLBACK_RATIO = 1.4;

export function caretPosition(field: HTMLTextAreaElement, index: number): CaretPosition {
  const style = window.getComputedStyle(field);
  const mirror = document.createElement("div");
  for (const property of MIRRORED_PROPERTIES) {
    mirror.style.setProperty(property, style.getPropertyValue(property));
  }
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.overflow = "hidden";
  mirror.textContent = field.value.slice(0, index);
  const marker = document.createElement("span");
  marker.textContent = field.value.slice(index) || ".";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const fontSize = Number.parseFloat(style.fontSize);
  const lineHeight =
    Number.parseFloat(style.lineHeight) || fontSize * LINE_HEIGHT_FALLBACK_RATIO;
  const position = {
    left: marker.offsetLeft + Number.parseFloat(style.borderLeftWidth) - field.scrollLeft,
    top: marker.offsetTop + Number.parseFloat(style.borderTopWidth) - field.scrollTop,
    lineHeight,
  };
  mirror.remove();
  return position;
}

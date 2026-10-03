export function fitTitleInputHeight(element: HTMLTextAreaElement | null) {
  if (!element) {
    return;
  }
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

export function focusTitleInputAtEnd(element: HTMLTextAreaElement | null) {
  if (!element) {
    return;
  }
  fitTitleInputHeight(element);
  element.focus();
  element.setSelectionRange(element.value.length, element.value.length);
}

import { useEffect, useRef } from "react";

/**
 * Every open dialog listens on document, so a shared stack decides which one
 * Escape closes. Without it a confirmation layered over a form would dismiss
 * both and discard the form's input.
 */
const escapeStack: symbol[] = [];

export function useEscapeKey(onEscape: () => void): void {
  const handlerRef = useRef(onEscape);
  handlerRef.current = onEscape;

  useEffect(() => {
    const token = Symbol("escape-layer");
    escapeStack.push(token);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (escapeStack[escapeStack.length - 1] !== token) {
        return;
      }
      event.stopPropagation();
      handlerRef.current();
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      const index = escapeStack.lastIndexOf(token);
      if (index !== -1) {
        escapeStack.splice(index, 1);
      }
    };
  }, []);
}

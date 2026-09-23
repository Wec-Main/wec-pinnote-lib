import { useEffect, useRef } from "react";

const escapeStack: symbol[] = [];

export function useEscapeKey(onEscape: () => void, active = true): void {
  const handlerRef = useRef(onEscape);
  handlerRef.current = onEscape;

  useEffect(() => {
    if (!active) {
      return;
    }

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
  }, [active]);
}

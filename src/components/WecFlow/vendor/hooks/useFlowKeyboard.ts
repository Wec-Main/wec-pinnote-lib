import { useEffect, useRef } from "react";

export interface UseFlowKeyboardOptions {
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onEscape: () => void;
  /** When false, the hook does nothing (no listeners attached / handlers never fire). Default true. */
  enabled?: boolean;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName;
  if (tagName === "INPUT" || tagName === "TEXTAREA") {
    return true;
  }
  return target.isContentEditable === true;
}

/**
 * Attaches a single keydown listener on `window` that wires common flow
 * editing shortcuts (delete, undo, redo, escape) to the given callbacks.
 */
export function useFlowKeyboard(options: UseFlowKeyboardOptions): void {
  const { enabled = true } = options;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      const { onDelete, onUndo, onRedo, onEscape } = optionsRef.current;
      const editing = isEditableTarget(document.activeElement);

      if (event.key === "Escape") {
        onEscape();
        return;
      }

      if (editing) {
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        onDelete();
        return;
      }

      const isModifier = event.ctrlKey || event.metaKey;
      if (!isModifier) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "z" && event.shiftKey) {
        event.preventDefault();
        onRedo();
        return;
      }

      if (key === "z") {
        event.preventDefault();
        onUndo();
        return;
      }

      if (key === "y") {
        event.preventDefault();
        onRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled]);
}

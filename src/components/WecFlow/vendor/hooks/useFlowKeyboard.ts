import { useEffect, useRef } from "react";

export interface UseFlowKeyboardOptions {
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onEscape: () => void;
  onDuplicate?: () => void;
  onNudge?: (dx: number, dy: number) => void;
  /** When false, the hook does nothing (no listeners attached / handlers never fire). Default true. */
  enabled?: boolean;
}

const NUDGE_STEP = 1;
const NUDGE_STEP_LARGE = 10;

const ARROW_KEY_DELTAS: Record<string, { dx: number; dy: number }> = {
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
};

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
      const { onDelete, onUndo, onRedo, onEscape, onDuplicate, onNudge } = optionsRef.current;
      const editing = isEditableTarget(document.activeElement);

      if (event.key === "Escape") {
        if (editing) {
          (document.activeElement as HTMLElement).blur();
          return;
        }
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

      const arrowDelta = ARROW_KEY_DELTAS[event.key];
      if (arrowDelta && !isModifier && onNudge) {
        event.preventDefault();
        const step = event.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
        onNudge(arrowDelta.dx * step, arrowDelta.dy * step);
        return;
      }

      if (!isModifier) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "d" && onDuplicate) {
        event.preventDefault();
        onDuplicate();
        return;
      }

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

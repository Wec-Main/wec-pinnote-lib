import { useMemo, useRef, type MouseEvent, type MutableRefObject } from "react";

/**
 * A modal should close only when a click both starts and ends on the scrim.
 * Without the pointer-down check, releasing a text selection outside the
 * dialog — or a copy drag that ends on the backdrop — dismisses it.
 */
export function scrimDismissHandlers(
  pressedOnScrim: MutableRefObject<boolean>,
  onDismiss: () => void,
) {
  return {
    onPointerDown(event: MouseEvent<HTMLElement>) {
      pressedOnScrim.current = event.target === event.currentTarget;
    },
    onClick(event: MouseEvent<HTMLElement>) {
      const startedAndEndedOnScrim =
        pressedOnScrim.current && event.target === event.currentTarget;
      pressedOnScrim.current = false;
      if (startedAndEndedOnScrim) {
        onDismiss();
      }
    },
  };
}

export function useScrimDismiss(onDismiss: () => void) {
  const pressedOnScrim = useRef(false);
  return useMemo(() => scrimDismissHandlers(pressedOnScrim, onDismiss), [onDismiss]);
}

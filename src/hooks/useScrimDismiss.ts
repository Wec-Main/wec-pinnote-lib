import { useMemo, useRef, type MouseEvent, type MutableRefObject } from "react";

export function scrimDismissHandlers(
  pressedOnScrim: MutableRefObject<boolean>,
  onDismiss: () => void,
) {
  return {
    onPointerDown(event: MouseEvent<HTMLElement>) {
      pressedOnScrim.current = event.target === event.currentTarget;
    },
    onClick(event: MouseEvent<HTMLElement>) {
      const startedAndEndedOnScrim = pressedOnScrim.current && event.target === event.currentTarget;
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

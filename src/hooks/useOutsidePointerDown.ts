import { useEffect, type RefObject } from "react";

export function useOutsidePointerDown(
  ref: RefObject<HTMLElement | null>,
  onOutside: () => void,
  active: boolean = true,
): void {
  useEffect(() => {
    if (!active) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        onOutside();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [ref, onOutside, active]);
}

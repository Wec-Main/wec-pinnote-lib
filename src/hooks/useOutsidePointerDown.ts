import { useEffect, useRef, type RefObject } from "react";

export function useOutsidePointerDown(
  ref: RefObject<HTMLElement | null>,
  onOutside: () => void,
  active: boolean = true,
): void {
  const handlerRef = useRef(onOutside);
  handlerRef.current = onOutside;

  useEffect(() => {
    if (!active) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        handlerRef.current();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [ref, active]);
}

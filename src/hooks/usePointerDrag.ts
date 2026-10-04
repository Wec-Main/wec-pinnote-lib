import { useCallback, useEffect, useMemo, useRef } from "react";

export interface DragCallbacks {
  onStart?: (e: PointerEvent) => void;

  onMove: (e: PointerEvent, delta: { x: number; y: number }) => void;

  onEnd?: (e: PointerEvent, moved: boolean) => void;

  onCancel?: (moved: boolean) => void;

  threshold?: number;
}

export function usePointerDrag() {
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);

  const start = useCallback(
    (down: { clientX: number; clientY: number; pointerId?: number }, cb: DragCallbacks) => {
      cleanup.current?.();
      const startX = down.clientX;
      const startY = down.clientY;
      const pointerId = down.pointerId;
      const threshold = cb.threshold ?? 3;
      let moved = false;
      let frame = 0;
      let last: PointerEvent | null = null;

      const owns = (e: PointerEvent) => pointerId === undefined || e.pointerId === pointerId;
      const stopFrame = () => {
        if (frame) {
          cancelAnimationFrame(frame);
          frame = 0;
        }
      };
      const flush = () => {
        frame = 0;
        if (last) cb.onMove(last, { x: last.clientX - startX, y: last.clientY - startY });
      };
      const move = (e: PointerEvent) => {
        if (!owns(e)) return;
        if (!moved) {
          if (Math.hypot(e.clientX - startX, e.clientY - startY) < threshold) return;
          moved = true;
          cb.onStart?.(e);
        }
        last = e;
        if (!frame) frame = requestAnimationFrame(flush);
      };
      const up = (e: PointerEvent) => {
        if (!owns(e)) return;
        remove();
        if (frame) {
          stopFrame();
          flush();
        }
        cb.onEnd?.(e, moved);
      };
      const remove = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        cleanup.current = null;
      };
      const abandon = () => {
        remove();
        stopFrame();
        if (cb.onCancel) cb.onCancel(moved);
        else if (last) cb.onEnd?.(last, moved);
      };
      window.addEventListener("pointermove", move, { passive: true });
      window.addEventListener("pointerup", up, { passive: true });
      window.addEventListener("pointercancel", up, { passive: true });
      cleanup.current = abandon;
    },
    [],
  );

  return useMemo(() => Object.assign(start, { cancel: () => cleanup.current?.() }), [start]);
}

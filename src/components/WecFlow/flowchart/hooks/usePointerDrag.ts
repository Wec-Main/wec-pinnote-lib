import { useCallback, useEffect, useRef } from 'react';

export interface DragCallbacks {
  /** Called once the pointer moved past the threshold. */
  onStart?: (e: PointerEvent) => void;
  /** Called at most once per animation frame with the latest pointer event. */
  onMove: (e: PointerEvent, delta: { x: number; y: number }) => void;
  /** Called on release. `moved` is false for a simple click. */
  onEnd?: (e: PointerEvent, moved: boolean) => void;
  /** Pixels the pointer must travel before a drag starts (default 3). */
  threshold?: number;
}

/**
 * Generic window-level pointer drag tracking with rAF coalescing, so a drag
 * produces at most one state update per frame no matter the pointer rate.
 * Returns a function to call from an `onPointerDown` handler.
 */
export function usePointerDrag() {
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);

  return useCallback((down: { clientX: number; clientY: number }, cb: DragCallbacks) => {
    cleanup.current?.();
    const startX = down.clientX;
    const startY = down.clientY;
    const threshold = cb.threshold ?? 3;
    let moved = false;
    let frame = 0;
    let last: PointerEvent | null = null;

    const flush = () => {
      frame = 0;
      if (last) cb.onMove(last, { x: last.clientX - startX, y: last.clientY - startY });
    };
    const move = (e: PointerEvent) => {
      if (!moved) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < threshold) return;
        moved = true;
        cb.onStart?.(e);
      }
      last = e;
      if (!frame) frame = requestAnimationFrame(flush);
    };
    const up = (e: PointerEvent) => {
      remove();
      if (frame) {
        cancelAnimationFrame(frame);
        flush();
      }
      cb.onEnd?.(e, moved);
    };
    const remove = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      cleanup.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    cleanup.current = remove;
  }, []);
}

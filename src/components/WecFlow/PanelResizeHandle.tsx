import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

const RESIZING_BODY_CLASS = "wpn-flowchart-resizing";

interface PanelResizeHandleProps {
  side: "left" | "right";
  width: number;
  minWidth: number;
  maxWidth: number;
  ariaLabel: string;
  onResize: (width: number) => void;
}

export function PanelResizeHandle({
  side,
  width,
  minWidth,
  maxWidth,
  ariaLabel,
  onResize,
}: PanelResizeHandleProps) {
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  const clamp = useCallback(
    (value: number) => Math.max(minWidth, Math.min(maxWidth, value)),
    [maxWidth, minWidth],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    const pointerId = event.pointerId;

    const handleMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const delta = moveEvent.clientX - startX;
      onResize(clamp(startWidth + (side === "left" ? delta : -delta)));
    };

    const handleUp = (upEvent?: PointerEvent) => {
      if (upEvent && upEvent.pointerId !== pointerId) return;
      document.body.classList.remove(RESIZING_BODY_CLASS);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      cleanupRef.current = null;
    };

    document.body.classList.add(RESIZING_BODY_CLASS);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    cleanupRef.current = handleUp;
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 32 : 8;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onResize(clamp(width + (side === "left" ? -step : step)));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      onResize(clamp(width + (side === "left" ? step : -step)));
    }
  };

  return (
    <div
      className="wpn-flowchart-resize-handle"
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={ariaLabel}
      aria-valuenow={Math.round(width)}
      aria-valuetext={`${Math.round(width)} pixels`}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <span className="wpn-flowchart-resize-handle__grip" aria-hidden="true">
        <svg viewBox="0 0 6 20" width="6" height="20">
          <circle cx="1.5" cy="3" r="1.1" fill="currentColor" />
          <circle cx="1.5" cy="10" r="1.1" fill="currentColor" />
          <circle cx="1.5" cy="17" r="1.1" fill="currentColor" />
          <circle cx="4.5" cy="3" r="1.1" fill="currentColor" />
          <circle cx="4.5" cy="10" r="1.1" fill="currentColor" />
          <circle cx="4.5" cy="17" r="1.1" fill="currentColor" />
        </svg>
      </span>
    </div>
  );
}

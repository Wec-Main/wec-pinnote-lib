import type { MouseEvent as ReactMouseEvent } from "react";

interface ResizeHandleProps {
  onMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
}

export function ResizeHandle({ onMouseDown }: ResizeHandleProps) {
  return (
    <div
      className="wpn-epicflow-resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize columns"
      onMouseDown={onMouseDown}
    >
      <span className="wpn-epicflow-resize-handle__grip" aria-hidden="true">
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

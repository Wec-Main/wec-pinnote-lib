import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { Tooltip } from "../primitives";

export interface LauncherDragHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
}

interface LauncherButtonProps {
  label: string;
  active: boolean;
  blocked?: boolean;
  dragHandlers: LauncherDragHandlers;
  onActivate: () => void;
  children: ReactNode;
}

export function LauncherButton({
  label,
  active,
  blocked = false,
  dragHandlers,
  onActivate,
  children,
}: LauncherButtonProps) {
  const tooltip = blocked ? "Log in first" : label;
  return (
    <Tooltip label={tooltip} placement="right">
      <button
        type="button"
        className={[
          "wpn-launcher-item",
          active ? "wpn-launcher-item--active" : "",
          blocked ? "wpn-launcher-item--blocked" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label={label}
        aria-pressed={active}
        aria-disabled={blocked}
        {...dragHandlers}
        onClick={onActivate}
      >
        <span className="wpn-launcher-item__icon-wrap">{children}</span>
      </button>
    </Tooltip>
  );
}

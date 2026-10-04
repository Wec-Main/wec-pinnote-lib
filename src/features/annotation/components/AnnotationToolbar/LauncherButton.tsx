import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { Tooltip } from "../../../../components/primitives/Tooltip";

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
  onIntent?: () => void;
  children: ReactNode;
}

export function LauncherButton({
  label,
  active,
  blocked = false,
  dragHandlers,
  onActivate,
  onIntent,
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
        onPointerEnter={onIntent}
        onFocus={onIntent}
      >
        <span className="wpn-launcher-item__icon-wrap">{children}</span>
      </button>
    </Tooltip>
  );
}

interface LauncherPillProps {
  label: string;
  active?: boolean;
  blocked?: boolean;
  accent?: boolean;
  tone?: string;
  order: number;
  hint?: string;
  onActivate: () => void;
  onIntent?: () => void;
  children: ReactNode;
}

export function LauncherPill({
  label,
  active = false,
  blocked = false,
  accent = false,
  tone,
  order,
  hint,
  onActivate,
  onIntent,
  children,
}: LauncherPillProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={[
        "wpn-launcher__pill",
        active ? "wpn-launcher__pill--active" : "",
        blocked ? "wpn-launcher__pill--blocked" : "",
        accent ? "wpn-launcher__pill--accent" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ ["--i" as string]: order, ...(tone ? { ["--tone" as string]: tone } : {}) }}
      aria-label={label}
      aria-pressed={active}
      aria-disabled={blocked}
      title={blocked ? "Log in first" : hint}
      onClick={onActivate}
      onPointerEnter={onIntent}
      onFocus={onIntent}
    >
      <span className="wpn-launcher__pill-icon">{children}</span>
      <span className="wpn-launcher__pill-label">{label}</span>
      {active ? <span className="wpn-launcher__pill-dot" aria-hidden="true" /> : null}
    </button>
  );
}

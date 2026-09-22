import { cloneElement, useId, useState, type ReactElement, type ReactNode } from "react";

type TooltipPlacement = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  label: ReactNode;
  placement?: TooltipPlacement;
  children: ReactElement<{ "aria-describedby"?: string }>;
}

export function Tooltip({ label, placement = "top", children }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  return (
    <span
      className="wpn-tooltip"
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
    >
      {cloneElement(children, { "aria-describedby": open ? tooltipId : undefined })}
      <span
        id={tooltipId}
        role="tooltip"
        className={[
          "wpn-tooltip__bubble",
          `wpn-tooltip__bubble--${placement}`,
          open ? "wpn-tooltip__bubble--visible" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {label}
      </span>
    </span>
  );
}

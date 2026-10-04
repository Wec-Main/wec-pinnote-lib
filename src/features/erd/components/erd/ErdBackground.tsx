import { memo, useId } from "react";
import { useErdState } from "../../ErdContext";

export type ErdBackgroundVariant = "dots" | "lines" | "none";

const GRID_SIZE = 24;
const MIN_GRID_GAP_PX = 10;

export const ErdBackground = memo(function ErdBackground({
  variant = "dots",
}: {
  variant?: ErdBackgroundVariant;
}) {
  const viewport = useErdState((s) => s.viewport);
  const id = `erd-grid${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (variant === "none") return null;

  let gap = GRID_SIZE * viewport.zoom;
  while (gap < MIN_GRID_GAP_PX) gap *= 2;
  return (
    <svg className="wpn-erd-canvas__background" aria-hidden="true">
      <pattern
        id={id}
        x={viewport.x % gap}
        y={viewport.y % gap}
        width={gap}
        height={gap}
        patternUnits="userSpaceOnUse"
      >
        {variant === "dots" ? (
          <circle cx={gap / 2} cy={gap / 2} r={Math.max(0.7, Math.min(1.4, viewport.zoom))} />
        ) : (
          <path d={`M ${gap} 0 L 0 0 0 ${gap}`} />
        )}
      </pattern>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
});

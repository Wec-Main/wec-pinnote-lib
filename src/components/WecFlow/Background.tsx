import { memo, useId } from "react";
import { useFlowState } from "../../context/FlowContext";

export type BackgroundVariant = "dots" | "lines" | "none";

/** Grid pattern that moves and scales with the viewport. */
export const Background = memo(function Background({
  variant = "dots",
}: {
  variant?: BackgroundVariant;
}) {
  const viewport = useFlowState((s) => s.viewport);
  const gridSize = useFlowState((s) => s.gridSize);
  const id = `fb-grid${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (variant === "none") return null;

  // Show a coarser grid when zoomed far out to keep the pattern readable.
  let gap = gridSize * viewport.zoom;
  while (gap < 10) gap *= 2;
  const x = viewport.x % gap;
  const y = viewport.y % gap;
  return (
    <svg className="wpn-flowchart-canvas__background" aria-hidden="true">
      <pattern id={id} x={x} y={y} width={gap} height={gap} patternUnits="userSpaceOnUse">
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

import { memo } from "react";
import { useFlowEngine, useFlowState } from "../../context/FlowContext";
import { cx } from "../../utils/flowchart/shallow";
import { Icon } from "./FlowIcons";
import type { BackgroundVariant } from "./Background";

export type CanvasMode = "pan" | "select";

interface Props {
  mode: CanvasMode;
  onModeChange: (mode: CanvasMode) => void;
  grid: BackgroundVariant;
  onGridChange: (grid: BackgroundVariant) => void;
  miniMapVisible: boolean;
  onMiniMapToggle: () => void;
}

const nextGrid: Record<BackgroundVariant, BackgroundVariant> = {
  dots: "lines",
  lines: "none",
  none: "dots",
};
const gridLabel: Record<BackgroundVariant, string> = {
  dots: "Dotted grid",
  lines: "Line grid",
  none: "No grid",
};

/** Floating zoom / fit / mode / view controls. */
export const Controls = memo(function Controls({
  mode,
  onModeChange,
  grid,
  onGridChange,
  miniMapVisible,
  onMiniMapToggle,
}: Props) {
  const engine = useFlowEngine();
  const zoom = useFlowState((s) => Math.round(s.viewport.zoom * 100));
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  return (
    <div
      className="wpn-flowchart-canvas__controls"
      onPointerDown={stop}
      onDoubleClick={(e) => e.stopPropagation()}
      data-flow-overlay
    >
      <div className="wpn-flowchart-canvas__control-group">
        <button
          type="button"
          className={cx(
            "wpn-flowchart-canvas__control-btn",
            mode === "pan" && "wpn-flowchart-canvas__control-active",
          )}
          title="Pan mode (drag to move the canvas)"
          onClick={() => onModeChange("pan")}
        >
          <Icon name="hand" />
        </button>
        <button
          type="button"
          className={cx(
            "wpn-flowchart-canvas__control-btn",
            mode === "select" && "wpn-flowchart-canvas__control-active",
          )}
          title="Selection mode (drag to select, hold Space to pan)"
          onClick={() => onModeChange("select")}
        >
          <Icon name="select" />
        </button>
      </div>
      <div className="wpn-flowchart-canvas__control-group">
        <button
          type="button"
          className="wpn-flowchart-canvas__control-btn"
          title="Zoom out (-)"
          onClick={engine.zoomOut}
        >
          <Icon name="minus" />
        </button>
        <button
          type="button"
          className="wpn-flowchart-canvas__zoom-value"
          title="Reset zoom to 100% (1)"
          onClick={() => engine.zoomTo(1)}
        >
          {zoom}%
        </button>
        <button
          type="button"
          className="wpn-flowchart-canvas__control-btn"
          title="Zoom in (+)"
          onClick={engine.zoomIn}
        >
          <Icon name="plus" />
        </button>
        <button
          type="button"
          className="wpn-flowchart-canvas__control-btn"
          title="Fit view (F)"
          onClick={() => engine.fitView()}
        >
          <Icon name="fit" />
        </button>
      </div>
      <div className="wpn-flowchart-canvas__control-group">
        <button
          type="button"
          className={cx(
            "wpn-flowchart-canvas__control-btn",
            grid !== "none" && "wpn-flowchart-canvas__control-active",
          )}
          title={`${gridLabel[grid]}. Click for ${gridLabel[nextGrid[grid]].toLowerCase()}`}
          aria-label="Change grid style"
          onClick={() => onGridChange(nextGrid[grid])}
        >
          <Icon name="grid" />
        </button>
        <button
          type="button"
          className={cx(
            "wpn-flowchart-canvas__control-btn",
            miniMapVisible && "wpn-flowchart-canvas__control-active",
          )}
          title={miniMapVisible ? "Hide minimap" : "Show minimap"}
          aria-pressed={miniMapVisible}
          onClick={onMiniMapToggle}
        >
          <Icon name="map" />
        </button>
      </div>
    </div>
  );
});

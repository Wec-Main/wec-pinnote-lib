import { memo } from "react";
import { useErdEngine, useErdState } from "../../ErdContext";
import { cx } from "../../../../utils/flowchart/shallow";
import { Icon } from "../../../flowchart/components/FlowIcons";
import type { ErdBackgroundVariant } from "./ErdBackground";

export type ErdCanvasMode = "pan" | "select";

interface Props {
  mode: ErdCanvasMode;
  onModeChange: (mode: ErdCanvasMode) => void;
  grid: ErdBackgroundVariant;
  onGridChange: (grid: ErdBackgroundVariant) => void;
  miniMapVisible: boolean;
  onMiniMapToggle: () => void;
}

const NEXT_GRID: Record<ErdBackgroundVariant, ErdBackgroundVariant> = {
  dots: "lines",
  lines: "none",
  none: "dots",
};

const GRID_LABEL: Record<ErdBackgroundVariant, string> = {
  dots: "Dotted grid",
  lines: "Line grid",
  none: "No grid",
};

const stopPointer = (e: React.PointerEvent) => e.stopPropagation();

export const ErdControls = memo(function ErdControls({
  mode,
  onModeChange,
  grid,
  onGridChange,
  miniMapVisible,
  onMiniMapToggle,
}: Props) {
  const engine = useErdEngine();
  const zoom = useErdState((s) => Math.round(s.viewport.zoom * 100));
  return (
    <div
      className="wpn-erd-controls"
      onPointerDown={stopPointer}
      onDoubleClick={(e) => e.stopPropagation()}
      data-erd-overlay
    >
      <div className="wpn-erd-controls__group">
        <button
          type="button"
          className={cx("wpn-erd-controls__btn", mode === "pan" && "wpn-erd-controls__btn--active")}
          title="Pan mode (drag to move the canvas)"
          onClick={() => onModeChange("pan")}
        >
          <Icon name="hand" />
        </button>
        <button
          type="button"
          className={cx(
            "wpn-erd-controls__btn",
            mode === "select" && "wpn-erd-controls__btn--active",
          )}
          title="Selection mode (drag to select, hold Space to pan)"
          onClick={() => onModeChange("select")}
        >
          <Icon name="select" />
        </button>
      </div>
      <div className="wpn-erd-controls__group">
        <button
          type="button"
          className="wpn-erd-controls__btn"
          title="Zoom out (-)"
          onClick={engine.zoomOut}
        >
          <Icon name="minus" />
        </button>
        <button
          type="button"
          className="wpn-erd-controls__zoom"
          title="Reset zoom to 100%"
          onClick={() => engine.zoomTo(1)}
        >
          {zoom}%
        </button>
        <button
          type="button"
          className="wpn-erd-controls__btn"
          title="Zoom in (+)"
          onClick={engine.zoomIn}
        >
          <Icon name="plus" />
        </button>
        <button
          type="button"
          className="wpn-erd-controls__btn"
          title="Fit view (F)"
          onClick={() => engine.fitView()}
        >
          <Icon name="fit" />
        </button>
      </div>
      <div className="wpn-erd-controls__group">
        <button
          type="button"
          className={cx(
            "wpn-erd-controls__btn",
            grid !== "none" && "wpn-erd-controls__btn--active",
          )}
          title={`${GRID_LABEL[grid]}. Click for ${GRID_LABEL[NEXT_GRID[grid]].toLowerCase()}`}
          aria-label="Change grid style"
          onClick={() => onGridChange(NEXT_GRID[grid])}
        >
          <Icon name="grid" />
        </button>
        <button
          type="button"
          className={cx("wpn-erd-controls__btn", miniMapVisible && "wpn-erd-controls__btn--active")}
          title={miniMapVisible ? "Hide minimap" : "Show minimap"}
          aria-label={miniMapVisible ? "Hide minimap" : "Show minimap"}
          aria-pressed={miniMapVisible}
          onClick={onMiniMapToggle}
        >
          <Icon name="map" />
        </button>
      </div>
    </div>
  );
});

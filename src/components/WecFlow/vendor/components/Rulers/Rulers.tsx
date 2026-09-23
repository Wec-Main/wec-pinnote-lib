import { useMemo } from "react";
import "./rulers.css";

export interface RulersProps {
  viewport: { x: number; y: number; zoom: number };
  width: number;
  height: number;
}

const RULER_SIZE = 20;
const BASE_STEP = 100;

function ticksFor(offset: number, length: number, zoom: number): { position: number; label: number }[] {
  const step = BASE_STEP * zoom >= 40 ? BASE_STEP : BASE_STEP * Math.ceil(40 / (BASE_STEP * zoom));
  const scaledStep = step * zoom;
  const start = Math.floor(-offset / scaledStep) * scaledStep + (offset % scaledStep);
  const ticks: { position: number; label: number }[] = [];
  for (let position = start; position < length; position += scaledStep) {
    const worldValue = Math.round((position - offset) / zoom);
    ticks.push({ position, label: worldValue });
  }
  return ticks;
}

export function Rulers({ viewport, width, height }: RulersProps) {
  const horizontalTicks = useMemo(
    () => ticksFor(viewport.x, width, viewport.zoom),
    [viewport.x, viewport.zoom, width],
  );
  const verticalTicks = useMemo(
    () => ticksFor(viewport.y, height, viewport.zoom),
    [viewport.y, viewport.zoom, height],
  );

  return (
    <div className="wec-flow-rulers" aria-hidden="true">
      <div className="wec-flow-rulers__corner" />
      <div className="wec-flow-rulers__horizontal" style={{ left: RULER_SIZE }}>
        {horizontalTicks.map((tick) => (
          <div key={tick.position} className="wec-flow-rulers__tick-h" style={{ left: tick.position }}>
            <span>{tick.label}</span>
          </div>
        ))}
      </div>
      <div className="wec-flow-rulers__vertical" style={{ top: RULER_SIZE }}>
        {verticalTicks.map((tick) => (
          <div key={tick.position} className="wec-flow-rulers__tick-v" style={{ top: tick.position }}>
            <span>{tick.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

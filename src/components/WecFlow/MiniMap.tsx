import { memo, useCallback, useMemo, useRef } from "react";
import { useFlowEngine, useFlowState } from "../../context/FlowContext";
import { usePointerDrag } from "../../hooks/flowchart/usePointerDrag";
import { getBounds } from "../../utils/flowchart/geometry";

const WIDTH = 200;
const HEIGHT = 130;

/** Overview of the whole flow. Click or drag inside it to move the viewport. */
export const MiniMap = memo(function MiniMap() {
  const engine = useFlowEngine();
  const nodes = useFlowState((s) => s.nodes);
  const selected = useFlowState((s) => s.selectedNodeIds);
  const viewport = useFlowState((s) => s.viewport);
  const canvasSize = useFlowState((s) => s.canvasSize);
  const svgRef = useRef<SVGSVGElement>(null);
  const startDrag = usePointerDrag();

  const rects = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        rect: engine.getNodeRect(n),
        color: engine.getDefinition(n.type).color,
      })),
    [engine, nodes],
  );

  const view = {
    x: -viewport.x / viewport.zoom,
    y: -viewport.y / viewport.zoom,
    width: canvasSize.width / viewport.zoom,
    height: canvasSize.height / viewport.zoom,
  };
  const bounds = getBounds([...rects.map((r) => r.rect), view])!;
  const scale = Math.max(bounds.width / WIDTH, bounds.height / HEIGHT) * 1.1 || 1;
  const vbW = WIDTH * scale;
  const vbH = HEIGHT * scale;
  const vbX = bounds.x - (vbW - bounds.width) / 2;
  const vbY = bounds.y - (vbH - bounds.height) / 2;

  const moveTo = useCallback(
    (clientX: number, clientY: number) => {
      const r = svgRef.current?.getBoundingClientRect();
      if (!r) return;
      engine.centerOn({
        x: vbX + ((clientX - r.left) / r.width) * vbW,
        y: vbY + ((clientY - r.top) / r.height) * vbH,
      });
    },
    [engine, vbX, vbY, vbW, vbH],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    moveTo(e.clientX, e.clientY);
    // Keep the mapping fixed during the drag, otherwise the map would re-fit under the pointer.
    const frozen = { vbX, vbY, vbW, vbH };
    const r = svgRef.current!.getBoundingClientRect();
    startDrag(e, {
      threshold: 0,
      onMove: (ev) =>
        engine.centerOn({
          x: frozen.vbX + ((ev.clientX - r.left) / r.width) * frozen.vbW,
          y: frozen.vbY + ((ev.clientY - r.top) / r.height) * frozen.vbH,
        }),
    });
  };

  const outer = `M ${vbX} ${vbY} h ${vbW} v ${vbH} h ${-vbW} z`;
  const inner = `M ${view.x} ${view.y} v ${view.height} h ${view.width} v ${-view.height} z`;

  return (
    <div
      className="wpn-flowchart-canvas__minimap"
      onPointerDown={onPointerDown}
      onWheel={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      data-flow-overlay
    >
      <svg ref={svgRef} width={WIDTH} height={HEIGHT} viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}>
        {rects.map(({ id, rect, color }) => (
          <rect
            key={id}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            rx={6 * scale}
            fill={selected.has(id) ? "var(--fb-accent)" : color}
            fillOpacity={selected.has(id) ? 0.9 : 0.55}
          />
        ))}
        <path
          className="wpn-flowchart-canvas__minimap-mask"
          d={`${outer} ${inner}`}
          fillRule="evenodd"
        />
        <rect
          className="wpn-flowchart-canvas__minimap-view"
          x={view.x}
          y={view.y}
          width={view.width}
          height={view.height}
          strokeWidth={1.5 * scale}
        />
      </svg>
    </div>
  );
});

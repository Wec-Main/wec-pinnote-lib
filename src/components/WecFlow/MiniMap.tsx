import { memo, useCallback, useMemo, useRef } from "react";
import type { FlowNode, Rect } from "../../types/flowchart.types";
import { useFlowEngine, useFlowState } from "../../context/FlowContext";
import { usePointerDrag } from "../../hooks/flowchart/usePointerDrag";
import { getBounds } from "../../utils/flowchart/geometry";
import { isLaneShape } from "../../utils/flowchart/nodeTypes";

const WIDTH = 200;
const HEIGHT = 130;

interface MiniMapRect {
  id: string;
  rect: Rect;
  color: string;
  lane: boolean;
  node: FlowNode;
}

export const MiniMap = memo(function MiniMap() {
  const engine = useFlowEngine();
  const nodes = useFlowState((s) => s.nodes);
  const selected = useFlowState((s) => s.selectedNodeIds);
  const viewport = useFlowState((s) => s.viewport);
  const canvasSize = useFlowState((s) => s.canvasSize);
  // Node type definitions (and thus getNodeRect/getDefinition output) can
  // change independent of any node object's identity, so the rect cache must
  // be invalidated whenever the registry changes.
  const registryVersion = useFlowState((s) => s.registryVersion);
  const svgRef = useRef<SVGSVGElement>(null);
  const startDrag = usePointerDrag();

  // Dragging a single node always produces a brand-new `nodes` array
  // reference (positions update via `.map()`), which would otherwise force
  // this useMemo to recompute a rect for every node in the document on every
  // rAF frame. Instead, cache rects per node id and only recompute the
  // entries whose node reference actually changed since the last render.
  const rectCacheRef = useRef<Map<string, MiniMapRect>>(new Map());
  const lastRegistryVersionRef = useRef(registryVersion);

  const rects = useMemo(() => {
    const cache = rectCacheRef.current;
    if (lastRegistryVersionRef.current !== registryVersion) {
      cache.clear();
      lastRegistryVersionRef.current = registryVersion;
    }
    const next: MiniMapRect[] = [];
    const seen = new Set<string>();
    for (const n of nodes) {
      seen.add(n.id);
      const cached = cache.get(n.id);
      if (cached && cached.node === n) {
        next.push(cached);
        continue;
      }
      const entry: MiniMapRect = {
        id: n.id,
        rect: engine.getNodeRect(n),
        color: engine.getDefinition(n.type).color,
        lane: isLaneShape(engine.getDefinition(n.type).shape),
        node: n,
      };
      cache.set(n.id, entry);
      next.push(entry);
    }
    for (const id of cache.keys()) if (!seen.has(id)) cache.delete(id);
    next.sort((a, b) => Number(b.lane) - Number(a.lane));
    return next;
  }, [engine, nodes, registryVersion]);

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

    const frozen = { vbX, vbY, vbW, vbH };
    startDrag(e, {
      threshold: 0,
      onMove: (ev) => {
        const r = svgRef.current?.getBoundingClientRect();
        if (!r) return;
        engine.centerOn({
          x: frozen.vbX + ((ev.clientX - r.left) / r.width) * frozen.vbW,
          y: frozen.vbY + ((ev.clientY - r.top) / r.height) * frozen.vbH,
        });
      },
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
        {rects.map(({ id, rect, color, lane }) => (
          <rect
            key={id}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            rx={6 * scale}
            fill={selected.has(id) ? "var(--fb-accent)" : color}
            fillOpacity={selected.has(id) ? 0.9 : lane ? 0.15 : 0.55}
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

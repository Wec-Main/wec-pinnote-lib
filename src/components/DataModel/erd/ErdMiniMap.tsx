import { memo, useMemo, useRef } from "react";
import { useErdEngine, useErdState } from "../../../context/ErdContext";
import { usePointerDrag } from "../../../hooks/flowchart/usePointerDrag";
import type { ErdEntity, ErdNote } from "../../../types/dataModel.types";
import type { Rect } from "../../../types/flowchart.types";
import { getEntityRect, getNoteRect } from "../../../utils/erd/erdGeometry";
import { getBounds } from "../../../utils/flowchart/geometry";

const WIDTH = 200;
const HEIGHT = 130;
const ENTITY_COLOR = "#6366f1";
const NOTE_COLOR = "#eab308";

interface ErdMiniMapRect {
  id: string;
  rect: Rect;
  color: string;
  ref: ErdEntity | ErdNote;
}

export const ErdMiniMap = memo(function ErdMiniMap() {
  const engine = useErdEngine();
  const entities = useErdState((s) => s.entities);
  const notes = useErdState((s) => s.notes);
  const selection = useErdState((s) => s.selection);
  const viewport = useErdState((s) => s.viewport);
  const canvasSize = useErdState((s) => s.canvasSize);
  const svgRef = useRef<SVGSVGElement>(null);
  const startDrag = usePointerDrag();

  // Dragging a single entity/note always produces a brand-new `entities`/
  // `notes` array reference (positions update via `.map()`), which would
  // otherwise force this useMemo to recompute a rect for every entity and
  // note in the document on every rAF frame. Instead, cache rects per id and
  // only recompute entries whose entity/note reference actually changed
  // since the last render. Selection is intentionally not part of the cache
  // key: it's looked up separately at render time so toggling selection
  // never has to invalidate (or stale-serve) a position-derived rect.
  const rectCacheRef = useRef<Map<string, ErdMiniMapRect>>(new Map());

  const rects = useMemo(() => {
    const cache = rectCacheRef.current;
    const next: ErdMiniMapRect[] = [];
    const seen = new Set<string>();
    for (const note of notes) {
      seen.add(note.id);
      const cached = cache.get(note.id);
      if (cached && cached.ref === note) {
        next.push(cached);
        continue;
      }
      const entry: ErdMiniMapRect = { id: note.id, rect: getNoteRect(note), color: NOTE_COLOR, ref: note };
      cache.set(note.id, entry);
      next.push(entry);
    }
    for (const entity of entities) {
      seen.add(entity.id);
      const cached = cache.get(entity.id);
      if (cached && cached.ref === entity) {
        next.push(cached);
        continue;
      }
      const entry: ErdMiniMapRect = {
        id: entity.id,
        rect: getEntityRect(entity),
        color: ENTITY_COLOR,
        ref: entity,
      };
      cache.set(entity.id, entry);
      next.push(entry);
    }
    for (const id of cache.keys()) if (!seen.has(id)) cache.delete(id);
    return next;
  }, [entities, notes]);

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

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const frozen = { vbX, vbY, vbW, vbH };
    const moveTo = (clientX: number, clientY: number) => {
      const r = svgRef.current?.getBoundingClientRect();
      if (!r) return;
      engine.centerOn({
        x: frozen.vbX + ((clientX - r.left) / r.width) * frozen.vbW,
        y: frozen.vbY + ((clientY - r.top) / r.height) * frozen.vbH,
      });
    };
    moveTo(e.clientX, e.clientY);
    startDrag(e, { threshold: 0, onMove: (ev) => moveTo(ev.clientX, ev.clientY) });
  };

  const outer = `M ${vbX} ${vbY} h ${vbW} v ${vbH} h ${-vbW} z`;
  const inner = `M ${view.x} ${view.y} v ${view.height} h ${view.width} v ${-view.height} z`;

  return (
    <div
      className="wpn-flowchart-canvas__minimap wpn-erd-minimap"
      onPointerDown={onPointerDown}
      onWheel={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      data-erd-overlay
    >
      <svg ref={svgRef} width={WIDTH} height={HEIGHT} viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}>
        {rects.map(({ id, rect, color }) => {
          const selected = selection.entityIds.has(id) || selection.noteIds.has(id);
          return (
            <rect
              key={id}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              rx={6 * scale}
              fill={selected ? "var(--wpn-accent)" : color}
              fillOpacity={selected ? 0.9 : 0.55}
            />
          );
        })}
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

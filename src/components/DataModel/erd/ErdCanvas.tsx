import { memo, useCallback, useEffect, useState, type ReactNode } from "react";
import { useErdContext, useErdState } from "../../../context/ErdContext";
import { useErdKeyboardShortcuts } from "../../../hooks/erd/useErdKeyboardShortcuts";
import { usePointerDrag } from "../../../hooks/flowchart/usePointerDrag";
import {
  ENTITY_DEFAULT_WIDTH,
  ERD_PALETTE_DRAG_MIME,
  NOTE_DEFAULT_SIZE,
} from "../../../utils/erd/erdConstants";
import { rectFromPoints } from "../../../utils/flowchart/geometry";
import { cx, shallowEqual } from "../../../utils/flowchart/shallow";
import { Icon } from "../../WecFlow/FlowIcons";
import { ErdBackground, type ErdBackgroundVariant } from "./ErdBackground";
import { ErdControls, type ErdCanvasMode } from "./ErdControls";
import { ErdEdgeLayer } from "./ErdEdgeLayer";
import { ErdSelectionBox } from "./ErdSelectionBox";
import { EntityNode } from "./EntityNode";
import { NoteNode } from "./NoteNode";

const WHEEL_LINE_UNIT = 0.05;
const WHEEL_PAGE_UNIT = 1;
const WHEEL_PIXEL_UNIT = 0.0022;
const WHEEL_PINCH_SPEED = 4;
const ENTITY_DROP_HEADER_OFFSET = 18;

const ViewportLayer = memo(function ViewportLayer() {
  const { x, y, zoom } = useErdState((s) => s.viewport);
  const entityIds = useErdState((s) => s.entities.map((entity) => entity.id), shallowEqual);
  const noteIds = useErdState((s) => s.notes.map((note) => note.id), shallowEqual);
  return (
    <div
      className="wpn-erd-canvas__viewport"
      style={{ transform: `translate(${x}px, ${y}px) scale(${zoom})` }}
    >
      {noteIds.map((id) => (
        <NoteNode key={id} id={id} />
      ))}
      <ErdEdgeLayer />
      {entityIds.map((id) => (
        <EntityNode key={id} id={id} />
      ))}
    </div>
  );
});

const EmptyState = memo(function EmptyState() {
  const empty = useErdState((s) => s.entities.length === 0 && s.notes.length === 0);
  const readOnly = useErdState((s) => s.readOnly);
  if (!empty) return null;
  return (
    <div className="wpn-erd-canvas__empty">
      <div className="wpn-erd-canvas__empty-icon">
        <Icon name="database" size={26} />
      </div>
      <div className="wpn-erd-canvas__empty-title">
        {readOnly ? "This data model is empty" : "Start designing your data model"}
      </div>
      {!readOnly && (
        <div className="wpn-erd-canvas__empty-text">
          Drag an entity from the left panel onto the canvas, or click one to add it.
        </div>
      )}
    </div>
  );
});

const ConnectionHint = memo(function ConnectionHint() {
  const reason = useErdState((s) =>
    s.connection && !s.connection.valid ? s.connection.reason : undefined,
  );
  return reason ? <div className="wpn-erd-canvas__hint">{reason}</div> : null;
});

function isPaletteDrag(e: React.DragEvent): boolean {
  return e.dataTransfer.types.includes(ERD_PALETTE_DRAG_MIME);
}

export function ErdCanvas({ children }: { children?: ReactNode }) {
  const { engine, canvasRef, clientToCanvas, clientToFlow } = useErdContext();
  const readOnly = useErdState((s) => s.readOnly);
  const [mode, setMode] = useState<ErdCanvasMode>("pan");
  const [panning, setPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [grid, setGrid] = useState<ErdBackgroundVariant>("dots");
  const startDrag = usePointerDrag();
  const onShortcutKeyDown = useErdKeyboardShortcuts();

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      engine.setCanvasSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [engine, canvasRef]);

  useEffect(() => {
    const release = () => setSpaceHeld(false);
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", release);
    return () => {
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", release);
    };
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.shiftKey && !e.ctrlKey) {
        engine.panBy(-(e.deltaX || e.deltaY), 0);
        return;
      }
      const unit =
        e.deltaMode === 1
          ? WHEEL_LINE_UNIT
          : e.deltaMode === 2
            ? WHEEL_PAGE_UNIT
            : WHEEL_PIXEL_UNIT;
      const speed = e.ctrlKey ? WHEEL_PINCH_SPEED : 1;
      engine.zoomAt(
        Math.pow(2, -e.deltaY * unit * speed),
        clientToCanvas({ x: e.clientX, y: e.clientY }),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [engine, canvasRef, clientToCanvas]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      canvasRef.current?.focus({ preventScroll: true });
      const selecting = e.button === 0 && !spaceHeld && (mode === "select" || e.shiftKey);
      if (selecting) {
        const additive = e.shiftKey || e.metaKey || e.ctrlKey;
        const origin = clientToFlow({ x: e.clientX, y: e.clientY });
        startDrag(e, {
          onMove: (ev) => {
            const rect = rectFromPoints(origin, clientToFlow({ x: ev.clientX, y: ev.clientY }));
            engine.setSelectionRect(rect);
            engine.selectInRect(rect, additive);
          },
          onEnd: (_ev, moved) => {
            engine.setSelectionRect(null);
            if (!moved && !additive) engine.clearSelection();
          },
          onCancel: () => engine.setSelectionRect(null),
        });
        return;
      }
      if (e.button !== 0 && e.button !== 1) return;
      e.preventDefault();
      let applied = { x: 0, y: 0 };
      startDrag(e, {
        onStart: () => setPanning(true),
        onMove: (_ev, delta) => {
          const current = engine.getState().viewport;
          engine.setViewport({
            ...current,
            x: current.x + (delta.x - applied.x),
            y: current.y + (delta.y - applied.y),
          });
          applied = delta;
        },
        onEnd: (_ev, moved) => {
          setPanning(false);
          if (!moved) engine.clearSelection();
        },
        onCancel: () => setPanning(false),
      });
    },
    [engine, canvasRef, clientToFlow, mode, spaceHeld, startDrag],
  );

  const onSpaceKey = (e: React.KeyboardEvent) => {
    if (e.key !== " " || e.target !== e.currentTarget) return;
    e.preventDefault();
    setSpaceHeld(e.type === "keydown");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      startDrag.cancel();
      engine.cancelInteraction();
    }
    onSpaceKey(e);
    onShortcutKeyDown(e);
  };

  const onDragOver = (e: React.DragEvent) => {
    if (readOnly || !isPaletteDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const onDrop = (e: React.DragEvent) => {
    const kind = e.dataTransfer.getData(ERD_PALETTE_DRAG_MIME);
    if (readOnly || (kind !== "entity" && kind !== "note")) return;
    e.preventDefault();
    const point = clientToFlow({ x: e.clientX, y: e.clientY });
    if (kind === "entity") {
      const entity = engine.addEntity({
        position: {
          x: Math.round(point.x - ENTITY_DEFAULT_WIDTH / 2),
          y: Math.round(point.y - ENTITY_DROP_HEADER_OFFSET),
        },
      });
      engine.select("entity", entity.id);
    } else {
      const note = engine.addNote({
        position: {
          x: Math.round(point.x - NOTE_DEFAULT_SIZE.width / 2),
          y: Math.round(point.y - NOTE_DEFAULT_SIZE.height / 2),
        },
      });
      engine.select("note", note.id);
    }
    canvasRef.current?.focus({ preventScroll: true });
  };

  return (
    <div
      ref={canvasRef}
      className={cx(
        "wpn-erd-canvas",
        mode === "select" && !spaceHeld && "wpn-erd-canvas--select",
        (panning || spaceHeld) && "wpn-erd-canvas--panning",
      )}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onKeyUp={onSpaceKey}
      onBlur={() => setSpaceHeld(false)}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ErdBackground variant={grid} />
      <ViewportLayer />
      <ErdSelectionBox />
      <EmptyState />
      <ConnectionHint />
      <ErdControls mode={mode} onModeChange={setMode} grid={grid} onGridChange={setGrid} />
      {children && (
        <div
          className="wpn-erd-canvas__overlay"
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          data-erd-overlay
        >
          {children}
        </div>
      )}
    </div>
  );
}

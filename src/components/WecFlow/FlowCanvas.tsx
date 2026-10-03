import { memo, useCallback, useEffect, useState, type ReactNode } from "react";
import { useFlowContext, useFlowState } from "../../context/FlowContext";
import { useKeyboardShortcuts } from "../../hooks/flowchart/useKeyboardShortcuts";
import { usePointerDrag } from "../../hooks/flowchart/usePointerDrag";
import { NODE_DRAG_MIME } from "../../utils/flowchart/constants";
import { rectFromPoints } from "../../utils/flowchart/geometry";
import { useEdgeDropTarget } from "../../hooks/flowchart/useEdgeDropTarget";
import { cx } from "../../utils/flowchart/shallow";
import { ContextMenu, type ContextMenuRequest, type ContextMenuTarget } from "./ContextMenu";
import {
  dropTargetEdgeStore,
  EdgeControlsLayer,
  EdgeLabelRenderer,
  EdgeRenderer,
  useDropTargetEdge,
} from "./EdgeRenderer";
import { NodeRenderer } from "./NodeRenderer";
import { Icon } from "./FlowIcons";
import { Background, type BackgroundVariant } from "./Background";
import { Controls, type CanvasMode } from "./Controls";
import { MiniMap } from "./MiniMap";

export interface FlowCanvasProps {
  background?: BackgroundVariant;
  showMiniMap?: boolean;
  showControls?: boolean;

  keyboardShortcuts?: boolean;
  className?: string;

  children?: ReactNode;
}

const EdgeDropIndicator = memo(function EdgeDropIndicator() {
  const target = useDropTargetEdge();
  if (!target) return null;
  return (
    <div
      className="wpn-flowchart-canvas__edge-drop"
      style={{ left: target.x, top: target.y }}
      aria-hidden="true"
    >
      <Icon name="plus" size={12} />
    </div>
  );
});

const ViewportLayer = memo(function ViewportLayer() {
  const { x, y, zoom } = useFlowState((s) => s.viewport);
  return (
    <div
      className="wpn-flowchart-canvas__viewport"
      style={{ transform: `translate(${x}px, ${y}px) scale(${zoom})` }}
    >
      <NodeRenderer lanes />
      <EdgeRenderer />
      <EdgeLabelRenderer />
      <NodeRenderer />
      <EdgeControlsLayer />
      <AlignmentGuides />
    </div>
  );
});

const AlignmentGuides = memo(function AlignmentGuides() {
  const guides = useFlowState((s) => s.guides);
  if (guides.length === 0) return null;
  return (
    <svg className="wpn-flowchart-canvas__guides" aria-hidden="true">
      {guides.map((g) =>
        g.axis === "x" ? (
          <line
            key={`x${g.position}`}
            x1={g.position}
            x2={g.position}
            y1={g.start - 12}
            y2={g.end + 12}
          />
        ) : (
          <line
            key={`y${g.position}`}
            x1={g.start - 12}
            x2={g.end + 12}
            y1={g.position}
            y2={g.position}
          />
        ),
      )}
    </svg>
  );
});

function menuTargetAt(element: EventTarget | null): ContextMenuTarget | null {
  if (!(element instanceof Element)) return { kind: "canvas" };
  if (element.closest("[data-flow-overlay]")) return null;
  const nodeId = element.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId;
  if (nodeId) return { kind: "node", id: nodeId };
  const edgeId = element.closest("[data-edge-id]")?.getAttribute("data-edge-id");
  if (edgeId) return { kind: "edge", id: edgeId };
  return { kind: "canvas" };
}

const SelectionBox = memo(function SelectionBox() {
  const rect = useFlowState((s) => s.selectionRect);
  const v = useFlowState((s) => (s.selectionRect ? s.viewport : null));
  if (!rect || !v) return null;
  return (
    <div
      className="wpn-flowchart-canvas__selection-box"
      style={{
        left: rect.x * v.zoom + v.x,
        top: rect.y * v.zoom + v.y,
        width: rect.width * v.zoom,
        height: rect.height * v.zoom,
      }}
    />
  );
});

const EmptyState = memo(function EmptyState() {
  const empty = useFlowState((s) => s.nodes.length === 0);
  const readOnly = useFlowState((s) => s.readOnly);
  if (!empty) return null;
  return (
    <div className="wpn-flowchart-canvas__empty">
      <div className="wpn-flowchart-canvas__empty-icon">
        <Icon name="flow" size={26} />
      </div>
      <div className="wpn-flowchart-canvas__empty-title">
        {readOnly ? "This flow is empty" : "Start building your flow"}
      </div>
      {!readOnly && (
        <div className="wpn-flowchart-canvas__empty-text">
          Drag a node from the left panel onto the canvas, or click one to add it.
        </div>
      )}
    </div>
  );
});

const ConnectionHint = memo(function ConnectionHint() {
  const reason = useFlowState((s) =>
    s.connection && !s.connection.valid ? s.connection.reason : undefined,
  );
  return reason ? <div className="wpn-flowchart-canvas__hint">{reason}</div> : null;
});

export function FlowCanvas({
  background = "dots",
  showMiniMap = true,
  showControls = true,
  keyboardShortcuts = true,
  className,
  children,
}: FlowCanvasProps) {
  const { engine, canvasRef, clientToCanvas, clientToFlow } = useFlowContext();
  const edgeDropAtPoint = useEdgeDropTarget();
  const readOnly = useFlowState((s) => s.readOnly);
  const [mode, setMode] = useState<CanvasMode>("pan");
  const [panning, setPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [grid, setGrid] = useState<BackgroundVariant>(background);
  const [miniMapVisible, setMiniMapVisible] = useState(showMiniMap);
  const [menu, setMenu] = useState<ContextMenuRequest | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const startDrag = usePointerDrag();
  const onKeyDown = useKeyboardShortcuts();

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      engine.setCanvasSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
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
      const unit = e.deltaMode === 1 ? 0.05 : e.deltaMode === 2 ? 1 : 0.0022;
      const speed = e.ctrlKey ? 4 : 1;
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
        onMove: (_ev, d) => {
          const current = engine.getState().viewport;
          engine.setViewport({
            ...current,
            x: current.x + (d.x - applied.x),
            y: current.y + (d.y - applied.y),
          });
          applied = d;
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

  const openMenu = (e: React.MouseEvent, target: ContextMenuTarget) => {
    const client = { x: e.clientX, y: e.clientY };
    if (target.kind === "node" && !engine.getState().selectedNodeIds.has(target.id))
      engine.selectNode(target.id);
    if (target.kind === "edge") engine.selectEdge(target.id);
    setMenu({ target, screen: clientToCanvas(client), flow: clientToFlow(client) });
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const target = menuTargetAt(e.target);
    if (target) openMenu(e, target);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (readOnly || menuTargetAt(e.target)?.kind !== "canvas") return;
    openMenu(e, { kind: "canvas" });
  };

  const onSpaceKey = (e: React.KeyboardEvent) => {
    if (e.key !== " " || e.target !== e.currentTarget) return;
    e.preventDefault();
    setSpaceHeld(e.type === "keydown");
  };

  const onCanvasKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      startDrag.cancel();
      engine.cancelInteraction();
    }
    onSpaceKey(e);
    if (keyboardShortcuts) onKeyDown(e);
  };

  const onDragOver = (e: React.DragEvent) => {
    if (readOnly || !e.dataTransfer.types.includes(NODE_DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    dropTargetEdgeStore.set(edgeDropAtPoint(e.clientX, e.clientY));
  };

  const onDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    dropTargetEdgeStore.set(null);
  };

  const onDrop = (e: React.DragEvent) => {
    const type = e.dataTransfer.getData(NODE_DRAG_MIME);
    const target = edgeDropAtPoint(e.clientX, e.clientY);
    dropTargetEdgeStore.set(null);
    if (readOnly || !type) return;
    e.preventDefault();
    const p = clientToFlow({ x: e.clientX, y: e.clientY });
    if (target && engine.insertNodeOnEdge(target.edgeId, type, p)) {
      canvasRef.current?.focus({ preventScroll: true });
      return;
    }
    const def = engine.getDefinition(type);
    const node = engine.addNode({
      type,
      position: engine.snap({
        x: p.x - def.defaultSize.width / 2,
        y: p.y - def.defaultSize.height / 2,
      }),
    });
    engine.selectNode(node.id);
    canvasRef.current?.focus({ preventScroll: true });
  };

  return (
    <div
      ref={canvasRef}
      className={cx(
        "wpn-flowchart-canvas__canvas",
        mode === "select" && !spaceHeld && "wpn-flowchart-canvas__mode-select",
        (panning || spaceHeld) && "wpn-flowchart-canvas__panning",
        className,
      )}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onCanvasKeyDown}
      onKeyUp={onSpaceKey}
      onBlur={() => setSpaceHeld(false)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
    >
      <Background variant={grid} />
      <ViewportLayer />
      <SelectionBox />
      <EdgeDropIndicator />
      <EmptyState />
      <ConnectionHint />
      {showControls && (
        <Controls
          mode={mode}
          onModeChange={setMode}
          grid={grid}
          onGridChange={setGrid}
          miniMapVisible={miniMapVisible}
          onMiniMapToggle={() => setMiniMapVisible((visible) => !visible)}
        />
      )}
      {miniMapVisible && <MiniMap />}
      {children}
      {menu && <ContextMenu request={menu} onClose={closeMenu} />}
    </div>
  );
}

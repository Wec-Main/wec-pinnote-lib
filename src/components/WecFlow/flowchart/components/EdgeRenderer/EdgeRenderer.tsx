import { memo, useCallback, useId, useState, useSyncExternalStore } from 'react';
import { useFlowContext, useFlowEngine, useFlowState } from '../../hooks/FlowContext';
import { useEdgeGeometry } from '../../hooks/useEdgeGeometry';
import { usePointerDrag } from '../../hooks/usePointerDrag';
import type { EdgeEnd } from '../../core/FlowEngine';
import type { XYPosition } from '../../models/FlowTypes';
import { getEdgePath, type StepBend } from '../../utils/edgePaths';
import { findHandle, getHandlePosition, oppositeSide } from '../../utils/geometry';
import { cx, shallowEqual } from '../../utils/shallow';
import { Icon } from '../icons';
import { lineStyleOptions } from '../lineStyles';
import styles from './EdgeRenderer.module.css';

const useEdgeIds = () => useFlowState((s) => s.edges.map((e) => e.id), shallowEqual);

/** Local, non-persisted hover tracking shared between the SVG and HTML edge layers. */
const hoverStore = (() => {
  let current: string | null = null;
  const listeners = new Set<() => void>();
  return {
    set(next: string | null | ((prev: string | null) => string | null)) {
      const value = typeof next === 'function' ? next(current) : next;
      if (current === value) return;
      current = value;
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => current,
  };
})();

function useHoveredEdgeId(): string | null {
  return useSyncExternalStore(hoverStore.subscribe, hoverStore.getSnapshot, hoverStore.getSnapshot);
}

function useEdgeSelect(id: string) {
  const { engine, canvasRef } = useFlowContext();
  return useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      canvasRef.current?.focus({ preventScroll: true });
      engine.selectEdge(id, e.shiftKey || e.metaKey || e.ctrlKey);
    },
    [engine, canvasRef, id],
  );
}

const EdgeItem = memo(function EdgeItem({ id, markerPrefix }: { id: string; markerPrefix: string }) {
  const geometry = useEdgeGeometry(id);
  const selected = useFlowState((s) => s.selectedEdgeIds.has(id));
  const issue = useFlowState((s) => s.issueEdgeIds.get(id));
  const reconnecting = useFlowState((s) => s.connection?.reconnecting === id);
  const onPointerDown = useEdgeSelect(id);
  if (!geometry) return null;
  const marker = selected ? 'selected' : issue === 'error' ? 'error' : 'default';
  return (
    <g
      className={cx(
        styles.edge,
        selected && styles.selected,
        issue && styles[`issue-${issue}`],
        geometry.edge.animated && styles.animated,
        reconnecting && styles.reconnecting,
      )}
      data-edge-id={id}
      onPointerEnter={() => hoverStore.set(id)}
      onPointerLeave={() => hoverStore.set((current) => (current === id ? null : current))}
    >
      <path className={styles.hit} d={geometry.path} onPointerDown={onPointerDown} />
      <path className={styles.path} d={geometry.path} markerEnd={`url(#${markerPrefix}-${marker})`} />
    </g>
  );
});

/** Line that follows the pointer while a connection is being dragged. */
const ConnectionLine = memo(function ConnectionLine() {
  const engine = useFlowEngine();
  const conn = useFlowState((s) => s.connection);
  const fromNode = useFlowState((s) => (s.connection ? s.nodeLookup.get(s.connection.from.nodeId) : undefined));
  const toNode = useFlowState((s) => (s.connection?.candidate ? s.nodeLookup.get(s.connection.candidate.nodeId) : undefined));
  const lineType = useFlowState((s) => s.defaultEdgeType);
  if (!conn || !fromNode) return null;
  const fromDef = engine.getDefinition(fromNode.type);
  const fromHandle = findHandle(fromDef, conn.from.kind, conn.from.handleId);
  if (!fromHandle) return null;
  const start = getHandlePosition(fromNode, fromDef, fromHandle);
  let end = conn.pointer;
  let endSide = oppositeSide[fromHandle.side];
  if (conn.candidate && toNode) {
    const toDef = engine.getDefinition(toNode.type);
    const h = findHandle(toDef, conn.from.kind === 'source' ? 'target' : 'source', conn.candidate.handleId);
    if (h) {
      end = getHandlePosition(toNode, toDef, h);
      endSide = h.side;
    }
  }
  const { path } = getEdgePath(lineType, { source: start, sourceSide: fromHandle.side, target: end, targetSide: endSide });
  const state = conn.candidate ? (conn.valid ? styles.connValid : styles.connInvalid) : conn.reason ? styles.connInvalid : undefined;
  return (
    <g className={cx(styles.connection, state)}>
      <path d={path} />
      <circle cx={end.x} cy={end.y} r={3.5} />
    </g>
  );
});

/** SVG layer with every edge plus the in-progress connection line. */
export const EdgeRenderer = memo(function EdgeRenderer() {
  const ids = useEdgeIds();
  const markerPrefix = `fb-arrow${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg className={styles.layer}>
      <defs>
        {(['default', 'selected', 'error'] as const).map((kind) => (
          <marker key={kind} id={`${markerPrefix}-${kind}`} className={styles[`marker-${kind}`]} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0.5 L 9 5 L 0 9.5 z" />
          </marker>
        ))}
      </defs>
      {ids.map((id) => (
        <EdgeItem key={id} id={id} markerPrefix={markerPrefix} />
      ))}
      <ConnectionLine />
    </svg>
  );
});

// --------------------------------------------------------------- labels

/** Floating pill shown while hovering or selecting an edge, for one-click line-style switching. */
const EdgeStyleMenu = memo(function EdgeStyleMenu({ id, x, y }: { id: string; x: number; y: number }) {
  const engine = useFlowEngine();
  const readOnly = useFlowState((s) => s.readOnly);
  const current = useFlowState((s) => s.edgeLookup.get(id)?.type ?? s.defaultEdgeType);
  if (readOnly) return null;
  return (
    <div className={styles.styleMenu} style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -100%)` }} onPointerDown={(e) => e.stopPropagation()}>
      {lineStyleOptions.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={cx(styles.styleMenuItem, current === opt.value && styles.styleMenuItemActive)}
          title={opt.label}
          aria-label={opt.label}
          onClick={() => engine.updateEdge(id, { type: opt.value })}
        >
          <Icon name={opt.icon} size={13} />
        </button>
      ))}
    </div>
  );
});

const EdgeLabel = memo(function EdgeLabel({ id }: { id: string }) {
  const engine = useFlowEngine();
  const geometry = useEdgeGeometry(id);
  const selected = useFlowState((s) => s.selectedEdgeIds.has(id));
  const readOnly = useFlowState((s) => s.readOnly);
  const hoveredId = useHoveredEdgeId();
  const onPointerDown = useEdgeSelect(id);
  const [editing, setEditing] = useState<string | null>(null);

  if (!geometry) return null;
  const { edge, labelX, labelY } = geometry;
  const showMenu = !readOnly && (selected || hoveredId === id);
  if (!edge.label && (!selected || readOnly) && editing === null && !showMenu) return null;

  const commit = () => {
    if (editing !== null && editing !== (edge.label ?? '')) engine.updateEdge(id, { label: editing.trim() || undefined });
    setEditing(null);
  };

  return (
    <>
      {showMenu && <EdgeStyleMenu id={id} x={labelX} y={labelY - 18} />}
      {(edge.label || selected || editing !== null) && (
        <div
          className={cx(styles.label, selected && styles.labelSelected, !edge.label && styles.labelEmpty)}
          style={{ transform: `translate(${labelX}px, ${labelY}px) translate(-50%, -50%)` }}
          onPointerDown={onPointerDown}
          onDoubleClick={() => !readOnly && setEditing(edge.label ?? '')}
          title={readOnly ? undefined : 'Double-click to edit label'}
        >
          {editing !== null ? (
            <input
              autoFocus
              className={styles.labelInput}
              value={editing}
              size={Math.max(4, editing.length + 1)}
              onChange={(e) => setEditing(e.target.value)}
              onBlur={commit}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') setEditing(null);
              }}
            />
          ) : (
            <span>{edge.label || (readOnly ? '' : 'Add label')}</span>
          )}
        </div>
      )}
    </>
  );
});

/** HTML layer for edge labels (rendered above edges, below nodes). */
export const EdgeLabelRenderer = memo(function EdgeLabelRenderer() {
  const ids = useEdgeIds();
  return (
    <div className={styles.labelLayer}>
      {ids.map((id) => (
        <EdgeLabel key={id} id={id} />
      ))}
    </div>
  );
});

// ------------------------------------------------------------- controls

const LABEL_CLEARANCE = 56;

function bendHandlePoint({ axis, handle, span }: StepBend, label: XYPosition): XYPosition {
  const along = axis === 'y' ? 'x' : 'y';
  const across = axis === 'y' ? 'y' : 'x';
  if (Math.abs(handle[across] - label[across]) > 14 || Math.abs(handle[along] - label[along]) >= LABEL_CLEARANCE) return handle;
  const [min, max] = span;
  const before = label[along] - LABEL_CLEARANCE;
  const after = label[along] + LABEL_CLEARANCE;
  const position = max - after >= before - min ? Math.min(after, max) : Math.max(before, min);
  return { ...handle, [along]: position };
}

const EdgeControls = memo(function EdgeControls({ id }: { id: string }) {
  const { engine, clientToFlow } = useFlowContext();
  const geometry = useEdgeGeometry(id);
  const readOnly = useFlowState((s) => s.readOnly);
  const reconnecting = useFlowState((s) => s.connection?.reconnecting === id);
  const startDrag = usePointerDrag();
  if (!geometry || readOnly) return null;
  const { bend } = geometry;
  const pointerFlow = (e: { clientX: number; clientY: number }) => clientToFlow({ x: e.clientX, y: e.clientY });

  const onBendPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !bend) return;
    e.stopPropagation();
    e.preventDefault();
    engine.beginInteraction();
    startDrag(e, {
      threshold: 0,
      onMove: (ev) => {
        const p = pointerFlow(ev);
        engine.setEdgeBend(id, Math.round(bend.axis === 'y' ? p.y : p.x));
      },
      onEnd: () => engine.endInteraction(),
    });
  };

  const onEndPointerDown = (end: EdgeEnd) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    engine.startReconnect(id, end, pointerFlow(e));
    startDrag(e, {
      threshold: 0,
      onMove: (ev) => engine.updateConnection(pointerFlow(ev)),
      onEnd: () => engine.endConnection(),
    });
  };

  const ends: [EdgeEnd, XYPosition][] = [
    ['source', geometry.source],
    ['target', geometry.target],
  ];
  const bendPoint = bend && bendHandlePoint(bend, { x: geometry.labelX, y: geometry.labelY });

  return (
    <>
      {bend && bendPoint && !reconnecting && (
        <div
          className={cx(styles.bendHandle, styles[`bend-${bend.axis}`], geometry.edge.bend !== undefined && styles.bendMoved)}
          style={{ transform: `translate(${bendPoint.x}px, ${bendPoint.y}px) translate(-50%, -50%)` }}
          title="Drag to move this segment. Double-click to reset the route."
          onPointerDown={onBendPointerDown}
          onDoubleClick={(e) => {
            e.stopPropagation();
            engine.setEdgeBend(id, undefined);
          }}
        />
      )}
      {!reconnecting &&
        ends.map(([end, p]) => (
          <div
            key={end}
            className={styles.endHandle}
            style={{ transform: `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)` }}
            title={end === 'source' ? 'Drag to reconnect the start of this connection' : 'Drag to reconnect the end of this connection'}
            onPointerDown={onEndPointerDown(end)}
          />
        ))}
    </>
  );
});

/** Interactive handles for selected edges: step bend and endpoint reconnection. Rendered above nodes. */
export const EdgeControlsLayer = memo(function EdgeControlsLayer() {
  const ids = useFlowState((s) => [...s.selectedEdgeIds], shallowEqual);
  if (ids.length === 0) return null;
  return (
    <div className={styles.controlsLayer} data-flow-overlay>
      {ids.map((id) => (
        <EdgeControls key={id} id={id} />
      ))}
    </div>
  );
});

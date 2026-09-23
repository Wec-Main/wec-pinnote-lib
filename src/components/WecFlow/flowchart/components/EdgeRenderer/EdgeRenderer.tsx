import { memo, useCallback, useId, useState } from 'react';
import { useFlowContext, useFlowEngine, useFlowState } from '../../hooks/FlowContext';
import { useEdgeGeometry } from '../../hooks/useEdgeGeometry';
import { getEdgePath } from '../../utils/edgePaths';
import { findHandle, getHandlePosition, oppositeSide } from '../../utils/geometry';
import { cx, shallowEqual } from '../../utils/shallow';
import { Icon } from '../icons';
import styles from './EdgeRenderer.module.css';

const useEdgeIds = () => useFlowState((s) => s.edges.map((e) => e.id), shallowEqual);

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
  const onPointerDown = useEdgeSelect(id);
  if (!geometry) return null;
  const marker = selected ? 'selected' : issue === 'error' ? 'error' : 'default';
  return (
    <g className={cx(styles.edge, selected && styles.selected, issue && styles[`issue-${issue}`], geometry.edge.animated && styles.animated)} data-edge-id={id}>
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

const EdgeLabel = memo(function EdgeLabel({ id }: { id: string }) {
  const engine = useFlowEngine();
  const geometry = useEdgeGeometry(id);
  const selected = useFlowState((s) => s.selectedEdgeIds.has(id));
  const readOnly = useFlowState((s) => s.readOnly);
  const onPointerDown = useEdgeSelect(id);
  const [editing, setEditing] = useState<string | null>(null);

  if (!geometry) return null;
  const { edge, labelX, labelY } = geometry;
  if (!edge.label && (!selected || readOnly) && editing === null) return null;

  const commit = () => {
    if (editing !== null && editing !== (edge.label ?? '')) engine.updateEdge(id, { label: editing.trim() || undefined });
    setEditing(null);
  };

  return (
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
      {selected && !readOnly && editing === null && (
        <button
          type="button"
          className={styles.labelDelete}
          title="Delete connection"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => engine.removeEdges([id])}
        >
          <Icon name="x" size={11} />
        </button>
      )}
    </div>
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

import { memo, useCallback } from 'react';
import { useFlowContext, useFlowState } from '../../hooks/FlowContext';
import { usePointerDrag } from '../../hooks/usePointerDrag';
import type { HandleDefinition, NodeTypeDefinition } from '../../models/NodeTypes';
import { getHandleOffset } from '../../utils/geometry';
import { cx } from '../../utils/shallow';
import styles from './NodeRenderer.module.css';

interface Props {
  nodeId: string;
  handle: HandleDefinition;
  definition: NodeTypeDefinition;
  width: number;
  height: number;
}

type Status = 'idle' | 'active' | 'connectable' | 'valid' | 'invalid';

/** Connection point. Dragging from it starts a new connection. */
export const Handle = memo(function Handle({ nodeId, handle, definition, width, height }: Props) {
  const { engine, clientToFlow } = useFlowContext();
  const startDrag = usePointerDrag();
  const status = useFlowState((s): Status => {
    const c = s.connection;
    if (!c) return 'idle';
    if (c.candidate?.nodeId === nodeId && c.candidate.handleId === handle.id) return c.valid ? 'valid' : 'invalid';
    if (c.from.nodeId === nodeId && c.from.handleId === handle.id) return 'active';
    return c.from.kind !== handle.kind && c.from.nodeId !== nodeId ? 'connectable' : 'idle';
  });

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      if (engine.getState().readOnly) return;
      engine.startConnection({ nodeId, handleId: handle.id, kind: handle.kind }, clientToFlow({ x: e.clientX, y: e.clientY }));
      startDrag(e, {
        threshold: 0,
        onMove: (ev) => engine.updateConnection(clientToFlow({ x: ev.clientX, y: ev.clientY })),
        onEnd: () => engine.endConnection(),
      });
    },
    [engine, nodeId, handle.id, handle.kind, clientToFlow, startDrag],
  );

  const offset = getHandleOffset(definition, handle, width, height);
  return (
    <div
      className={cx(styles.handle, styles[handle.kind], styles[`side-${handle.side}`], status !== 'idle' && styles[status])}
      style={{ left: offset.x, top: offset.y }}
      data-handle-id={handle.id}
      data-handle-kind={handle.kind}
      title={handle.label ?? (handle.kind === 'source' ? 'Output' : 'Input')}
      onPointerDown={onPointerDown}
    >
      {handle.label && <span className={styles.handleLabel}>{handle.label}</span>}
    </div>
  );
});

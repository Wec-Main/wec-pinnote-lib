import { useCallback } from 'react';
import { useFlowEngine } from '../../hooks/FlowContext';
import { usePointerDrag } from '../../hooks/usePointerDrag';
import type { NodeTypeDefinition } from '../../models/NodeTypes';
import { getNodeSize } from '../../utils/geometry';
import { cx } from '../../utils/shallow';
import styles from './NodeRenderer.module.css';

type Corner = 'nw' | 'ne' | 'sw' | 'se';
const corners: Corner[] = ['nw', 'ne', 'sw', 'se'];

/** Corner grips shown on a selected node. */
export function ResizeHandles({ nodeId, definition }: { nodeId: string; definition: NodeTypeDefinition }) {
  const engine = useFlowEngine();
  const startDrag = usePointerDrag();

  const onPointerDown = useCallback(
    (corner: Corner) => (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const node = engine.getNode(nodeId);
      if (!node) return;
      const start = { ...node.position, ...getNodeSize(node, definition) };
      const min = definition.minSize ?? { width: 60, height: 40 };
      startDrag(e, {
        onStart: () => engine.beginInteraction(),
        onMove: (_ev, delta) => {
          const zoom = engine.getState().viewport.zoom;
          const dx = delta.x / zoom;
          const dy = delta.y / zoom;
          const west = corner === 'nw' || corner === 'sw';
          const north = corner === 'nw' || corner === 'ne';
          const width = Math.max(min.width, Math.round(start.width + (west ? -dx : dx)));
          const height = Math.max(min.height, Math.round(start.height + (north ? -dy : dy)));
          engine.updateNode(nodeId, {
            width,
            height,
            position: {
              x: west ? start.x + start.width - width : start.x,
              y: north ? start.y + start.height - height : start.y,
            },
          });
        },
        onEnd: (_ev, moved) => {
          if (moved) engine.endInteraction();
        },
      });
    },
    [engine, nodeId, definition, startDrag],
  );

  return (
    <>
      <div className={styles.resizeOutline} />
      {corners.map((c) => (
        <div key={c} className={cx(styles.resize, styles[`resize-${c}`])} onPointerDown={onPointerDown(c)} />
      ))}
    </>
  );
}

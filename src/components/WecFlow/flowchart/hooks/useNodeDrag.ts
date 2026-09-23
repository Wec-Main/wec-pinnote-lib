import { useCallback } from 'react';
import type { XYPosition } from '../models/FlowTypes';
import { useFlowContext } from './FlowContext';
import { usePointerDrag } from './usePointerDrag';

/** Pointer-down handler that selects a node and drags it (and the rest of the selection). */
export function useNodeDrag(nodeId: string) {
  const { engine, canvasRef } = useFlowContext();
  const startDrag = usePointerDrag();

  return useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      canvasRef.current?.focus({ preventScroll: true });
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        engine.selectNode(nodeId, true);
        return;
      }
      if (!engine.getState().selectedNodeIds.has(nodeId)) engine.selectNode(nodeId);
      if (engine.getState().readOnly) return;

      const starts: Record<string, XYPosition> = {};
      for (const id of engine.getState().selectedNodeIds) {
        const n = engine.getNode(id);
        if (n) starts[id] = n.position;
      }
      startDrag(e, {
        onStart: () => engine.beginInteraction(),
        onMove: (_ev, delta) => {
          const zoom = engine.getState().viewport.zoom;
          const positions: Record<string, XYPosition> = {};
          for (const [id, p] of Object.entries(starts)) {
            positions[id] = engine.snap({ x: p.x + delta.x / zoom, y: p.y + delta.y / zoom });
          }
          engine.setNodePositions(positions);
        },
        onEnd: (_ev, moved) => {
          if (moved) engine.endInteraction();
        },
      });
    },
    [engine, canvasRef, nodeId, startDrag],
  );
}

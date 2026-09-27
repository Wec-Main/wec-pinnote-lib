import { useCallback } from "react";
import type { Rect, XYPosition } from "../../types/flowchart.types";
import { snapToAlignment } from "../../utils/flowchart/alignment";
import { getBounds } from "../../utils/flowchart/geometry";
import { useFlowContext } from "../../context/FlowContext";
import { dropTargetEdgeStore } from "../../components/WecFlow/EdgeRenderer";
import { useEdgeDropTarget } from "./useEdgeDropTarget";
import { usePointerDrag } from "./usePointerDrag";

const GUIDE_THRESHOLD_PX = 6;
const GUIDE_CANDIDATE_LIMIT = 200;

export function useNodeDrag(nodeId: string) {
  const { engine, canvasRef } = useFlowContext();
  const startDrag = usePointerDrag();
  const edgeDropAtPoint = useEdgeDropTarget();

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

      const { selectedNodeIds, nodes } = engine.getState();
      const starts: Record<string, XYPosition> = {};
      const others: Rect[] = [];
      for (const n of nodes) {
        if (selectedNodeIds.has(n.id)) starts[n.id] = n.position;
        else if (others.length < GUIDE_CANDIDATE_LIMIT) others.push(engine.getNodeRect(n));
      }
      const startBounds = getBounds(
        nodes.filter((n) => selectedNodeIds.has(n.id)).map((n) => engine.getNodeRect(n)),
      );

      // A single node can be dropped onto a connection to be spliced into it.
      // Its own edges stay untouched; the connection's ends rewire through it.
      const draggingIds = new Set(Object.keys(starts));
      const spliceCandidate = draggingIds.size === 1;

      startDrag(e, {
        onStart: () => engine.beginInteraction(),
        onMove: (ev, delta) => {
          const { zoom } = engine.getState().viewport;
          let shift = { x: delta.x / zoom, y: delta.y / zoom };
          const useGuides = !engine.getState().snapToGrid && !ev.altKey && startBounds !== null;
          if (useGuides) {
            const moved = {
              ...startBounds,
              x: startBounds.x + shift.x,
              y: startBounds.y + shift.y,
            };
            const snap = snapToAlignment(moved, others, GUIDE_THRESHOLD_PX / zoom);
            shift = { x: shift.x + snap.offset.x, y: shift.y + snap.offset.y };
            engine.setGuides(snap.guides);
          } else {
            engine.setGuides([]);
          }
          const positions: Record<string, XYPosition> = {};
          for (const [id, p] of Object.entries(starts)) {
            const next = { x: p.x + shift.x, y: p.y + shift.y };
            positions[id] = useGuides ? next : engine.snap(next);
          }
          engine.setNodePositions(positions);
          if (spliceCandidate) {
            dropTargetEdgeStore.set(
              edgeDropAtPoint(ev.clientX, ev.clientY, { excludeNodeIds: draggingIds }),
            );
          }
        },
        onEnd: (ev, moved) => {
          engine.setGuides([]);
          const target = spliceCandidate
            ? edgeDropAtPoint(ev.clientX, ev.clientY, { excludeNodeIds: draggingIds })
            : null;
          dropTargetEdgeStore.set(null);
          if (!moved) return;
          if (target) {
            engine.insertExistingNodeOnEdge(target.edgeId, nodeId);
          }
          engine.endInteraction();
        },
        onCancel: (moved) => {
          engine.setGuides([]);
          dropTargetEdgeStore.set(null);
          if (moved) engine.endInteraction();
        },
      });
    },
    [engine, canvasRef, edgeDropAtPoint, nodeId, startDrag],
  );
}

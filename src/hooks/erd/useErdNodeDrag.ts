import { useCallback } from "react";
import type { XYPosition } from "../../types/flowchart.types";
import { useErdContext } from "../../context/ErdContext";
import { usePointerDrag } from "../flowchart/usePointerDrag";

export type ErdDraggableKind = "entity" | "note";

export function useErdNodeDrag(id: string, kind: ErdDraggableKind) {
  const { engine, canvasRef } = useErdContext();
  const startDrag = usePointerDrag();

  return useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      canvasRef.current?.focus({ preventScroll: true });
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        engine.select(kind, id, true);
        return;
      }
      const { selection } = engine.getState();
      const selected = kind === "entity" ? selection.entityIds.has(id) : selection.noteIds.has(id);
      if (!selected) engine.select(kind, id);
      if (engine.getState().readOnly) return;

      const state = engine.getState();
      const starts: Record<string, XYPosition> = {};
      for (const entity of state.entities) {
        if (state.selection.entityIds.has(entity.id)) starts[entity.id] = entity.position;
      }
      for (const note of state.notes) {
        if (state.selection.noteIds.has(note.id)) starts[note.id] = note.position;
      }

      startDrag(e, {
        onStart: () => engine.beginInteraction(),
        onMove: (_ev, delta) => {
          const { zoom } = engine.getState().viewport;
          const positions: Record<string, XYPosition> = {};
          for (const [nodeId, start] of Object.entries(starts)) {
            positions[nodeId] = { x: start.x + delta.x / zoom, y: start.y + delta.y / zoom };
          }
          engine.setNodePositions(positions);
        },
        onEnd: (_ev, moved) => {
          if (moved) engine.endInteraction();
        },
        onCancel: (moved) => {
          if (moved) engine.endInteraction();
        },
      });
    },
    [engine, canvasRef, id, kind, startDrag],
  );
}

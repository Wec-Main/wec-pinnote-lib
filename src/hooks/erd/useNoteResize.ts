import { useCallback } from "react";
import { useErdContext } from "../../context/ErdContext";
import { NOTE_MIN_SIZE } from "../../utils/erd/erdConstants";
import { usePointerDrag } from "../flowchart/usePointerDrag";

export function useNoteResize(noteId: string) {
  const { engine } = useErdContext();
  const startDrag = usePointerDrag();

  return useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      const note = engine.getNote(noteId);
      if (!note || engine.getState().readOnly) return;
      const start = { width: note.width, height: note.height };
      startDrag(e, {
        threshold: 0,
        onStart: () => engine.beginInteraction(),
        onMove: (_ev, delta) => {
          const { zoom } = engine.getState().viewport;
          engine.updateNote(noteId, {
            width: Math.max(NOTE_MIN_SIZE.width, Math.round(start.width + delta.x / zoom)),
            height: Math.max(NOTE_MIN_SIZE.height, Math.round(start.height + delta.y / zoom)),
          });
        },
        onEnd: (_ev, moved) => {
          if (moved) engine.endInteraction();
        },
        onCancel: (moved) => {
          if (moved) engine.endInteraction();
        },
      });
    },
    [engine, noteId, startDrag],
  );
}

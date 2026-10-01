import { useCallback } from "react";
import { useErdContext } from "../../context/ErdContext";
import { usePointerDrag } from "../flowchart/usePointerDrag";

function entityIdAtPoint(clientX: number, clientY: number): string | null {
  const node = document
    .elementFromPoint(clientX, clientY)
    ?.closest<HTMLElement>("[data-entity-id]");
  return node?.dataset.entityId ?? null;
}

export function useEntityConnectionDrag(entityId: string) {
  const { engine, clientToFlow } = useErdContext();
  const startDrag = usePointerDrag();

  return useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      if (engine.getState().readOnly) return;
      engine.startConnection(entityId, clientToFlow({ x: e.clientX, y: e.clientY }));
      startDrag(e, {
        threshold: 0,
        onMove: (ev) =>
          engine.updateConnection(
            clientToFlow({ x: ev.clientX, y: ev.clientY }),
            entityIdAtPoint(ev.clientX, ev.clientY),
          ),
        onEnd: () => engine.endConnection(),
        onCancel: () => engine.cancelConnection(),
      });
    },
    [engine, entityId, clientToFlow, startDrag],
  );
}

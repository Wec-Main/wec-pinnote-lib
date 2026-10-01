import { memo } from "react";
import { useErdState } from "../../../context/ErdContext";

export const ErdSelectionBox = memo(function ErdSelectionBox() {
  const rect = useErdState((s) => s.selectionRect);
  const viewport = useErdState((s) => (s.selectionRect ? s.viewport : null));
  if (!rect || !viewport) return null;
  return (
    <div
      className="wpn-erd-selection"
      style={{
        left: rect.x * viewport.zoom + viewport.x,
        top: rect.y * viewport.zoom + viewport.y,
        width: rect.width * viewport.zoom,
        height: rect.height * viewport.zoom,
      }}
    />
  );
});

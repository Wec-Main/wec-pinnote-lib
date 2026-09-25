import { useCallback } from "react";
import { useFlowEngine } from "../../context/FlowContext";
import { usePointerDrag } from "../../hooks/flowchart/usePointerDrag";
import type { NodeTypeDefinition } from "../../utils/flowchart/nodeTypes";
import { getNodeSize } from "../../utils/flowchart/geometry";
import { cx } from "../../utils/flowchart/shallow";

type Handle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";
const handles: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

const west = new Set<Handle>(["nw", "w", "sw"]);
const east = new Set<Handle>(["ne", "e", "se"]);
const north = new Set<Handle>(["nw", "n", "ne"]);
const south = new Set<Handle>(["sw", "s", "se"]);

/**
 * Corner grips resize both dimensions at once; edge-midpoint grips (like
 * draw.io) resize only width (E/W) or only height (N/S).
 */
export function ResizeHandles({
  nodeId,
  definition,
}: {
  nodeId: string;
  definition: NodeTypeDefinition;
}) {
  const engine = useFlowEngine();
  const startDrag = usePointerDrag();

  const onPointerDown = useCallback(
    (handle: Handle) => (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const node = engine.getNode(nodeId);
      if (!node) return;
      const start = { ...node.position, ...getNodeSize(node, definition) };
      const min = definition.minSize ?? { width: 60, height: 40 };
      const resizesWidth = west.has(handle) || east.has(handle);
      const resizesHeight = north.has(handle) || south.has(handle);
      startDrag(e, {
        onStart: () => engine.beginInteraction(),
        onMove: (_ev, delta) => {
          const zoom = engine.getState().viewport.zoom;
          const dx = delta.x / zoom;
          const dy = delta.y / zoom;
          const width = resizesWidth
            ? Math.max(min.width, Math.round(start.width + (west.has(handle) ? -dx : dx)))
            : start.width;
          const height = resizesHeight
            ? Math.max(min.height, Math.round(start.height + (north.has(handle) ? -dy : dy)))
            : start.height;
          engine.updateNode(nodeId, {
            width,
            height,
            position: {
              x: west.has(handle) ? start.x + start.width - width : start.x,
              y: north.has(handle) ? start.y + start.height - height : start.y,
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
      <div className="wpn-flowchart-node__resize-outline" />
      {handles.map((h) => (
        <div
          key={h}
          className={cx("wpn-flowchart-node__resize", `wpn-flowchart-node__resize-${h}`)}
          onPointerDown={onPointerDown(h)}
        />
      ))}
    </>
  );
}

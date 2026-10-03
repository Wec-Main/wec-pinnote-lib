import { memo, useCallback } from "react";
import { useFlowContext } from "../../context/FlowContext";
import { usePointerDrag } from "../../hooks/flowchart/usePointerDrag";
import type { HandleSide } from "../../types/flowchart.types";
import { isLaneShape, type NodeTypeDefinition } from "../../utils/flowchart/nodeTypes";
import type { CSSProperties } from "react";

const OFFSET = 12;

const arrowPosition: Record<HandleSide, (w: number, h: number) => CSSProperties> = {
  top: (w) => ({ left: w / 2, top: -OFFSET }),
  bottom: (w, h) => ({ left: w / 2, top: h + OFFSET }),
  left: (_w, h) => ({ left: -OFFSET, top: h / 2 }),
  right: (w, h) => ({ left: w + OFFSET, top: h / 2 }),
};

const ArrowShape = ({ side }: { side: HandleSide }) => {
  const d: Record<HandleSide, string> = {
    right: "M0,2 L7,6 L0,10 Z",
    left: "M7,2 L0,6 L7,10 Z",
    bottom: "M2,0 L10,0 L6,7 Z",
    top: "M2,7 L10,7 L6,0 Z",
  };
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d={d[side]} fill="currentColor" />
    </svg>
  );
};

function outgoingSides(def: NodeTypeDefinition): HandleSide[] {
  return [...new Set(def.handles.filter((h) => h.kind === "source").map((h) => h.side))];
}

interface Props {
  nodeId: string;
  definition: NodeTypeDefinition;
  width: number;
  height: number;
}

export const HoverArrows = memo(function HoverArrows({ nodeId, definition, width, height }: Props) {
  const { engine, clientToFlow } = useFlowContext();
  const startDrag = usePointerDrag();

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, side: HandleSide) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      if (engine.getState().readOnly) return;

      const sourceHandle =
        definition.handles.find((h) => h.kind === "source" && h.side === side) ??
        definition.handles.find((h) => h.kind === "source");
      if (!sourceHandle) return;

      let connectionStarted = false;

      startDrag(e, {
        threshold: 6,
        onStart: (startEv) => {
          connectionStarted = true;
          engine.startConnection(
            { nodeId, handleId: sourceHandle.id, kind: "source" },
            clientToFlow({ x: startEv.clientX, y: startEv.clientY }),
          );
        },
        onMove: (ev) => {
          engine.updateConnection(clientToFlow({ x: ev.clientX, y: ev.clientY }));
        },
        onEnd: (_ev, moved) => {
          if (moved && connectionStarted) {
            engine.endConnection();
          } else {
            const defaultType =
              engine.registry.list().find((d) => !isLaneShape(d.shape))?.type ?? "process";
            engine.addConnectedNode(nodeId, side, defaultType);
          }
        },
        onCancel: (moved) => {
          if (moved && connectionStarted) engine.cancelConnection();
        },
      });
    },
    [engine, clientToFlow, startDrag, nodeId, definition],
  );

  const sides = outgoingSides(definition);
  if (sides.length === 0) return null;

  return (
    <>
      {sides.map((side) => (
        <div
          key={side}
          className={`wpn-flowchart-node__hover-arrow wpn-flowchart-node__hover-arrow-${side}`}
          style={arrowPosition[side](width, height)}
          onPointerDown={(e) => handlePointerDown(e, side)}
          title="Click to add · Drag to connect"
          role="button"
          aria-label={`Connect from ${side}`}
        >
          <ArrowShape side={side} />
        </div>
      ))}
    </>
  );
});

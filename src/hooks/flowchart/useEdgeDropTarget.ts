import { useCallback } from "react";
import { useFlowContext } from "../../context/FlowContext";
import { findEdgeDropTarget, type EdgeSegment } from "../../utils/flowchart/edgeDropTarget";
import { getStepPoints } from "../../utils/flowchart/edgePaths";
import { findHandle, flowToScreen, getHandlePosition } from "../../utils/flowchart/geometry";
import type { EdgeDropTarget } from "../../components/WecFlow/EdgeRenderer";

export const EDGE_DROP_TOLERANCE_PX = 28;

export interface EdgeDropOptions {
  /** Node being dragged: its own edges and body are never drop targets. */
  excludeNodeIds?: ReadonlySet<string>;
}

/**
 * Finds the connection nearest a screen point, for inserting a node into it.
 * Works from graph state rather than DOM hit-testing, because during an HTML5
 * drag the pointer sits over the drag image rather than the canvas.
 */
export function useEdgeDropTarget() {
  const { engine, clientToFlow } = useFlowContext();

  return useCallback(
    (clientX: number, clientY: number, options: EdgeDropOptions = {}): EdgeDropTarget | null => {
      const exclude = options.excludeNodeIds;
      const state = engine.getState();
      const segments: EdgeSegment[] = [];
      for (const edge of state.edges) {
        if (exclude?.has(edge.source) || exclude?.has(edge.target)) continue;
        const sourceNode = state.nodeLookup.get(edge.source);
        const targetNode = state.nodeLookup.get(edge.target);
        if (!sourceNode || !targetNode) continue;
        const sourceDef = engine.getDefinition(sourceNode.type);
        const targetDef = engine.getDefinition(targetNode.type);
        const sourceHandle =
          findHandle(sourceDef, "source", edge.sourceHandle) ?? findHandle(sourceDef, "source");
        const targetHandle =
          findHandle(targetDef, "target", edge.targetHandle) ?? findHandle(targetDef, "target");
        if (!sourceHandle || !targetHandle) continue;
        const input = {
          source: getHandlePosition(sourceNode, sourceDef, sourceHandle),
          sourceSide: sourceHandle.side,
          target: getHandlePosition(targetNode, targetDef, targetHandle),
          targetSide: targetHandle.side,
          bend: edge.bend,
        };
        const type = edge.type ?? state.defaultEdgeType;
        segments.push({
          edgeId: edge.id,
          points: type === "step" ? getStepPoints(input) : [input.source, input.target],
        });
      }
      const nodeRects = state.nodes
        .filter((node) => !exclude?.has(node.id))
        .map((node) => engine.getNodeRect(node));
      const point = clientToFlow({ x: clientX, y: clientY });
      const zoom = state.viewport.zoom || 1;
      const hit = findEdgeDropTarget(point, segments, nodeRects, EDGE_DROP_TOLERANCE_PX / zoom);
      if (!hit) return null;
      const canvasPoint = flowToScreen(hit.point, state.viewport);
      return { edgeId: hit.edgeId, distance: hit.distance, x: canvasPoint.x, y: canvasPoint.y };
    },
    [engine, clientToFlow],
  );
}

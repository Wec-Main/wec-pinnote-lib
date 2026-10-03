import { useCallback } from "react";
import { useFlowContext } from "../../context/FlowContext";
import { NODE_SPATIAL_PREFILTER_MARGIN } from "../../utils/flowchart/constants";
import { findEdgeDropTarget, type EdgeSegment } from "../../utils/flowchart/edgeDropTarget";
import { getStepPoints } from "../../utils/flowchart/edgePaths";
import { findHandle, flowToScreen, getHandlePosition } from "../../utils/flowchart/geometry";
import type { EdgeDropTarget } from "../../components/WecFlow/EdgeRenderer";

export const EDGE_DROP_TOLERANCE_PX = 28;

export interface EdgeDropOptions {
  excludeNodeIds?: ReadonlySet<string>;
}

export function useEdgeDropTarget() {
  const { engine, clientToFlow } = useFlowContext();

  return useCallback(
    (clientX: number, clientY: number, options: EdgeDropOptions = {}): EdgeDropTarget | null => {
      const exclude = options.excludeNodeIds;
      const state = engine.getState();
      const point = clientToFlow({ x: clientX, y: clientY });
      const zoom = state.viewport.zoom || 1;
      const tolerance = EDGE_DROP_TOLERANCE_PX / zoom;
      // Cheap bounding-box prefilter against the pointer position: anything
      // whose node position is farther than this from the point can't
      // possibly contain or pass within `tolerance` of it, so the expensive
      // handle/geometry work below can be skipped for it entirely. This
      // keeps cost proportional to nearby elements instead of total
      // document size on every drag frame.
      const reach = tolerance + NODE_SPATIAL_PREFILTER_MARGIN;
      const near = (pos: { x: number; y: number }, extra = 0) =>
        Math.abs(point.x - pos.x) <= reach + extra && Math.abs(point.y - pos.y) <= reach + extra;
      // Nodes are resizable, so an explicit width/height (read directly, no
      // registry lookup needed) can make a node far larger than the default
      // sizes PREFILTER_MARGIN assumes — fold it in per-node so a big
      // resized/group node is never incorrectly culled.
      const nodeReach = (node: { width?: number; height?: number }) =>
        Math.max(node.width ?? 0, node.height ?? 0);

      const segments: EdgeSegment[] = [];
      for (const edge of state.edges) {
        if (exclude?.has(edge.source) || exclude?.has(edge.target)) continue;
        const sourceNode = state.nodeLookup.get(edge.source);
        const targetNode = state.nodeLookup.get(edge.target);
        if (!sourceNode || !targetNode) continue;
        const bendMargin = Math.abs(edge.bend ?? 0);
        const sourceMargin = nodeReach(sourceNode) + bendMargin;
        const targetMargin = nodeReach(targetNode) + bendMargin;
        if (!near(sourceNode.position, sourceMargin) && !near(targetNode.position, targetMargin))
          continue;
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
        .filter((node) => !exclude?.has(node.id) && near(node.position, nodeReach(node)))
        .map((node) => engine.getNodeRect(node));
      const hit = findEdgeDropTarget(point, segments, nodeRects, tolerance);
      if (!hit) return null;
      const canvasPoint = flowToScreen(hit.point, state.viewport);
      return { edgeId: hit.edgeId, distance: hit.distance, x: canvasPoint.x, y: canvasPoint.y };
    },
    [engine, clientToFlow],
  );
}

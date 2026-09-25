import { useMemo } from "react";
import type { FlowEdge, HandleSide, XYPosition } from "../../types/flowchart.types";
import { getEdgePath, type EdgePath } from "../../utils/flowchart/edgePaths";
import { findHandle, getHandlePosition } from "../../utils/flowchart/geometry";
import { shallowEqual } from "../../utils/flowchart/shallow";
import { useFlowEngine, useFlowState } from "../../context/FlowContext";

export interface EdgeGeometry extends EdgePath {
  edge: FlowEdge;
  source: XYPosition;
  sourceSide: HandleSide;
  target: XYPosition;
  targetSide: HandleSide;
}

/**
 * Path of one edge. Re-computes only when the edge itself or one of its two
 * endpoint nodes changes, so dragging a node only re-renders its own edges.
 */
export function useEdgeGeometry(edgeId: string): EdgeGeometry | null {
  const engine = useFlowEngine();
  const [edge, sourceNode, targetNode, defaultType] = useFlowState((s) => {
    const e = s.edgeLookup.get(edgeId);
    return [
      e,
      e && s.nodeLookup.get(e.source),
      e && s.nodeLookup.get(e.target),
      s.defaultEdgeType,
    ] as const;
  }, shallowEqual);

  return useMemo(() => {
    if (!edge || !sourceNode || !targetNode) return null;
    const sDef = engine.getDefinition(sourceNode.type);
    const tDef = engine.getDefinition(targetNode.type);
    const sh = findHandle(sDef, "source", edge.sourceHandle) ?? findHandle(sDef, "source");
    const th = findHandle(tDef, "target", edge.targetHandle) ?? findHandle(tDef, "target");
    if (!sh || !th) return null;
    const source = getHandlePosition(sourceNode, sDef, sh);
    const target = getHandlePosition(targetNode, tDef, th);
    const path = getEdgePath(edge.type ?? defaultType, {
      source,
      sourceSide: sh.side,
      target,
      targetSide: th.side,
      bend: edge.bend,
    });
    return { ...path, edge, source, target, sourceSide: sh.side, targetSide: th.side };
  }, [engine, edge, sourceNode, targetNode, defaultType]);
}

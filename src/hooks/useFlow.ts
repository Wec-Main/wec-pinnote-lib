import { useMemo } from "react";
import type { FlowEdge, FlowNode } from "../types/flowchart.types";
import { shallowEqual } from "../utils/flowchart/shallow";
import { useFlowState } from "../features/flowchart/FlowContext";

export const useNodes = (): FlowNode[] => useFlowState((s) => s.nodes);
export const useEdges = (): FlowEdge[] => useFlowState((s) => s.edges);
export const useViewport = () => useFlowState((s) => s.viewport);
export const useReadOnly = () => useFlowState((s) => s.readOnly);

export function useSelection() {
  // nodeLookup/edgeLookup are mutated in place on position-only updates (see
  // flowEngine's commitPositions), so their own reference never changes.
  // Select the resolved node/edge objects directly instead of the lookup Map
  // itself: each entry gets a new reference whenever its content changes,
  // which shallowEqual can detect correctly regardless of Map identity.
  const nodes = useFlowState(
    (s) =>
      [...s.selectedNodeIds].map((id) => s.nodeLookup.get(id)).filter((n): n is FlowNode => !!n),
    shallowEqual,
  );
  const edges = useFlowState(
    (s) =>
      [...s.selectedEdgeIds].map((id) => s.edgeLookup.get(id)).filter((e): e is FlowEdge => !!e),
    shallowEqual,
  );
  return useMemo(() => ({ nodes, edges }), [nodes, edges]);
}

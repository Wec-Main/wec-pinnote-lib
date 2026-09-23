import { useMemo } from 'react';
import type { FlowEdge, FlowNode } from '../models/FlowTypes';
import { shallowEqual } from '../utils/shallow';
import { useFlowState } from './FlowContext';

export const useNodes = (): FlowNode[] => useFlowState((s) => s.nodes);
export const useEdges = (): FlowEdge[] => useFlowState((s) => s.edges);
export const useViewport = () => useFlowState((s) => s.viewport);
export const useReadOnly = () => useFlowState((s) => s.readOnly);

/** Currently selected nodes and edges. */
export function useSelection() {
  const [nodeIds, edgeIds] = useFlowState((s) => [s.selectedNodeIds, s.selectedEdgeIds] as const, shallowEqual);
  const nodeLookup = useFlowState((s) => s.nodeLookup);
  const edgeLookup = useFlowState((s) => s.edgeLookup);
  return useMemo(
    () => ({
      nodes: [...nodeIds].map((id) => nodeLookup.get(id)).filter((n): n is FlowNode => !!n),
      edges: [...edgeIds].map((id) => edgeLookup.get(id)).filter((e): e is FlowEdge => !!e),
    }),
    [nodeIds, edgeIds, nodeLookup, edgeLookup],
  );
}

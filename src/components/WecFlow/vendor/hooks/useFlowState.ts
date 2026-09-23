import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyNodeChanges, applyEdgeChanges, type NodeChange, type EdgeChange } from "@xyflow/react";
import type {
  FlowDefinition,
  FlowNode,
  FlowNodeData,
  FlowNodeType,
  FlowPosition,
} from "../types/flow.types";
import {
  toRFNode,
  toRFEdge,
  fromRFNode,
  fromRFEdge,
  type RFNode,
  type RFEdge,
} from "../utils/rfAdapters";
import { generateId } from "../utils/id";
import { useFlowHistory, type UseFlowHistoryResult } from "./useFlowHistory";

const TEXT_COMMIT_DEBOUNCE_MS = 400;

export interface UseFlowStateResult {
  flow: FlowDefinition;
  rfNodes: RFNode[];
  rfEdges: RFEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onNodesChange: (changes: NodeChange<RFNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<RFEdge>[]) => void;
  onConnect: (connection: {
    source: string | null;
    target: string | null;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }) => void;
  addNode: (type: FlowNodeType, position: FlowPosition, label: string) => string;
  updateNodeData: (
    nodeId: string,
    data: Partial<Pick<FlowNodeData, "label" | "description">>,
  ) => void;
  updateEdgeLabel: (edgeId: string, label: string) => void;
  deleteElements: (nodeIds: string[], edgeIds: string[]) => void;
  deleteSelected: () => void;
  clearSelection: () => void;
  replaceFlow: (flow: FlowDefinition) => void;
  history: UseFlowHistoryResult<FlowDefinition>;
}

function withEdgesPrunedForNodes(flow: FlowDefinition): FlowDefinition {
  const nodeIds = new Set(flow.nodes.map((n) => n.id));
  const edges = flow.edges.filter(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
  );
  return edges.length === flow.edges.length ? flow : { ...flow, edges };
}

export function useFlowState(initialFlow: FlowDefinition): UseFlowStateResult {
  const history = useFlowHistory<FlowDefinition>(initialFlow, { maxSize: 50 });
  const flow = history.present;

  // rfNodes/rfEdges are React Flow's OWN live state, not re-derived from the
  // domain model on every render. React Flow attaches internal metadata to
  // node objects (most importantly `measured` width/height, set via its own
  // ResizeObserver) that edges rely on to compute their paths. Rebuilding
  // the node array from `flow.nodes` on every change would strip that
  // metadata and edges would never render. Instead, `flow` (history.present)
  // is only used to seed/reset this state, and to carry committed snapshots
  // for undo/redo, export, and consumer callbacks.
  const [rfNodes, setRfNodes] = useState<RFNode[]>(() => initialFlow.nodes.map(toRFNode));
  const [rfEdges, setRfEdges] = useState<RFEdge[]>(() => initialFlow.edges.map(toRFEdge));

  const lastSyncedFlowRef = useRef<FlowDefinition>(initialFlow);

  useEffect(() => {
    if (flow !== lastSyncedFlowRef.current) {
      setRfNodes(flow.nodes.map(toRFNode));
      setRfEdges(flow.edges.map(toRFEdge));
      lastSyncedFlowRef.current = flow;
    }
  }, [flow]);

  const commitFlow = useCallback(
    (next: FlowDefinition) => {
      lastSyncedFlowRef.current = next;
      history.commit(next);
    },
    [history],
  );

  const selectedNodeId = useMemo(
    () => rfNodes.find((node) => node.selected)?.id ?? null,
    [rfNodes],
  );
  const selectedEdgeId = useMemo(
    () => rfEdges.find((edge) => edge.selected)?.id ?? null,
    [rfEdges],
  );

  const textCommitTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const scheduleTextCommit = useCallback(
    (key: string, next: FlowDefinition) => {
      // Intentionally does NOT touch history until the debounce fires: the
      // live-typed value is already visible via rfNodes/rfEdges (updated
      // immediately by the caller), so history.present can stay untouched as
      // the correct pre-edit undo baseline until this single, final commit.
      const timers = textCommitTimers.current;
      const existing = timers.get(key);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        timers.delete(key);
        commitFlow(next);
      }, TEXT_COMMIT_DEBOUNCE_MS);
      timers.set(key, timer);
    },
    [commitFlow],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<RFNode>[]) => {
      const nextRFNodes = applyNodeChanges(changes, rfNodes);

      const selectionChanges = changes.filter((change) => change.type === "select");
      const lastSelect = selectionChanges[selectionChanges.length - 1];
      if (lastSelect && lastSelect.selected) {
        setRfEdges((current) => current.map((edge) => ({ ...edge, selected: false })));
      }

      const meaningfulChanges = changes.filter(
        (change) => change.type !== "select" && change.type !== "dimensions",
      );

      setRfNodes(nextRFNodes);

      if (meaningfulChanges.length === 0) return;

      // While a node is actively being dragged, rfNodes above already gives
      // live visual feedback; history.present is deliberately left as the
      // pre-drag baseline until the drag ends, so the eventual single commit
      // captures "before drag -> final position" as one undo step instead of
      // one step per intermediate frame.
      const isTransientDrag = meaningfulChanges.some(
        (change) => change.type === "position" && change.dragging === true,
      );
      if (isTransientDrag) return;

      const nextFlow = withEdgesPrunedForNodes({
        ...flow,
        nodes: nextRFNodes.map(fromRFNode),
      });
      commitFlow(nextFlow);
    },
    [flow, rfNodes, commitFlow],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<RFEdge>[]) => {
      const nextRFEdges = applyEdgeChanges(changes, rfEdges);

      const selectionChanges = changes.filter((change) => change.type === "select");
      const lastSelect = selectionChanges[selectionChanges.length - 1];
      if (lastSelect && lastSelect.selected) {
        setRfNodes((current) => current.map((node) => ({ ...node, selected: false })));
      }

      const meaningfulChanges = changes.filter((change) => change.type !== "select");

      setRfEdges(nextRFEdges);

      if (meaningfulChanges.length === 0) return;

      const nextFlow: FlowDefinition = { ...flow, edges: nextRFEdges.map(fromRFEdge) };
      commitFlow(nextFlow);
    },
    [flow, rfEdges, commitFlow],
  );

  const onConnect = useCallback<UseFlowStateResult["onConnect"]>(
    (connection) => {
      if (!connection.source || !connection.target) return;
      const newEdge = {
        id: generateId("edge"),
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
      };
      setRfEdges((current) => [...current, toRFEdge(newEdge)]);
      commitFlow({ ...flow, edges: [...flow.edges, newEdge] });
    },
    [flow, commitFlow],
  );

  const addNode = useCallback<UseFlowStateResult["addNode"]>(
    (type, position, label) => {
      const id = generateId("node");
      const newNode: FlowNode = { id, type, position, data: { label } };
      setRfNodes((current) => [
        ...current.map((node) => ({ ...node, selected: false })),
        { ...toRFNode(newNode), selected: true },
      ]);
      setRfEdges((current) => current.map((edge) => ({ ...edge, selected: false })));
      commitFlow({ ...flow, nodes: [...flow.nodes, newNode] });
      return id;
    },
    [flow, commitFlow],
  );

  const updateNodeData = useCallback<UseFlowStateResult["updateNodeData"]>(
    (nodeId, data) => {
      setRfNodes((current) =>
        current.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node,
        ),
      );
      const nextFlow: FlowDefinition = {
        ...flow,
        nodes: flow.nodes.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node,
        ),
      };
      scheduleTextCommit(`node:${nodeId}`, nextFlow);
    },
    [flow, scheduleTextCommit],
  );

  const updateEdgeLabel = useCallback<UseFlowStateResult["updateEdgeLabel"]>(
    (edgeId, label) => {
      setRfEdges((current) =>
        current.map((edge) => (edge.id === edgeId ? { ...edge, label } : edge)),
      );
      const nextFlow: FlowDefinition = {
        ...flow,
        edges: flow.edges.map((edge) => (edge.id === edgeId ? { ...edge, label } : edge)),
      };
      scheduleTextCommit(`edge:${edgeId}`, nextFlow);
    },
    [flow, scheduleTextCommit],
  );

  const deleteElements = useCallback<UseFlowStateResult["deleteElements"]>(
    (nodeIds, edgeIds) => {
      if (nodeIds.length === 0 && edgeIds.length === 0) return;
      const nodeIdSet = new Set(nodeIds);
      const edgeIdSet = new Set(edgeIds);

      setRfNodes((current) => current.filter((node) => !nodeIdSet.has(node.id)));
      setRfEdges((current) =>
        current.filter(
          (edge) =>
            !edgeIdSet.has(edge.id) && !nodeIdSet.has(edge.source) && !nodeIdSet.has(edge.target),
        ),
      );

      const nextFlow = withEdgesPrunedForNodes({
        ...flow,
        nodes: flow.nodes.filter((node) => !nodeIdSet.has(node.id)),
        edges: flow.edges.filter((edge) => !edgeIdSet.has(edge.id)),
      });
      commitFlow(nextFlow);
    },
    [flow, commitFlow],
  );

  const deleteSelected = useCallback(() => {
    if (selectedNodeId) {
      deleteElements([selectedNodeId], []);
    } else if (selectedEdgeId) {
      deleteElements([], [selectedEdgeId]);
    }
  }, [selectedNodeId, selectedEdgeId, deleteElements]);

  const clearSelection = useCallback(() => {
    setRfNodes((current) => current.map((node) => (node.selected ? { ...node, selected: false } : node)));
    setRfEdges((current) => current.map((edge) => (edge.selected ? { ...edge, selected: false } : edge)));
  }, []);

  const replaceFlow = useCallback<UseFlowStateResult["replaceFlow"]>(
    (next) => {
      history.reset(next);
    },
    [history],
  );

  return {
    flow,
    rfNodes,
    rfEdges,
    selectedNodeId,
    selectedEdgeId,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    updateNodeData,
    updateEdgeLabel,
    deleteElements,
    deleteSelected,
    clearSelection,
    replaceFlow,
    history,
  };
}

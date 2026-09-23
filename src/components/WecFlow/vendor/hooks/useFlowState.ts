import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyNodeChanges, applyEdgeChanges, type NodeChange, type EdgeChange } from "@xyflow/react";
import type {
  FlowAlignEdge,
  FlowAxis,
  FlowDefinition,
  FlowEdge,
  FlowLayer,
  FlowNode,
  FlowNodeData,
  FlowNodeStyle,
  FlowNodeType,
  FlowPage,
  FlowPageGridSettings,
  FlowPageViewport,
  FlowPosition,
  RichText,
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
import { plainTextToRichText, richTextToPlainText } from "../utils/richText";
import { readDefaultNodeStyle } from "../utils/styleClipboard";
import { useFlowHistory, type UseFlowHistoryResult } from "./useFlowHistory";

const TEXT_COMMIT_DEBOUNCE_MS = 400;

export interface UseFlowStateResult {
  flow: FlowDefinition;
  activePageId: string;
  activePage: FlowPage;
  rfNodes: RFNode[];
  rfEdges: RFEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
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
  updateEdgeLabel: (edgeId: string, label: RichText) => void;
  updateEdgeStyle: (
    edgeId: string,
    updates: Partial<
      Pick<
        FlowEdge,
        | "lineStyle"
        | "arrow"
        | "arrowStart"
        | "arrowEnd"
        | "arrowStartShape"
        | "arrowEndShape"
        | "stroke"
        | "strokeWidth"
        | "routing"
      >
    >,
  ) => void;
  updateNodeStyle: (nodeId: string, updates: Partial<FlowNodeStyle>) => void;
  updateNodePosition: (nodeId: string, position: FlowPosition) => void;
  updateNodeSize: (nodeId: string, width: number, height: number) => void;
  setNodeRotation: (nodeId: string, degrees: number) => void;
  applyStyleToSelection: (updates: {
    node?: Partial<FlowNodeStyle>;
    edge?: Partial<
      Pick<
        FlowEdge,
        | "lineStyle"
        | "arrow"
        | "arrowStart"
        | "arrowEnd"
        | "arrowStartShape"
        | "arrowEndShape"
        | "stroke"
        | "strokeWidth"
        | "routing"
      >
    >;
  }) => void;
  duplicateNode: (nodeId: string) => string | null;
  duplicateSelected: () => void;
  deleteElements: (nodeIds: string[], edgeIds: string[]) => void;
  deleteSelected: () => void;
  clearSelection: () => void;
  selectAll: () => void;
  replaceFlow: (flow: FlowDefinition) => void;
  bringToFront: (nodeId: string) => void;
  sendToBack: (nodeId: string) => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  alignSelected: (edge: FlowAlignEdge) => void;
  distributeSelected: (axis: FlowAxis) => void;
  rotateSelected: (degrees: number) => void;
  flipSelected: (axis: FlowAxis) => void;
  lockSelected: () => void;
  unlockSelected: () => void;
  toggleNodeLock: (nodeId: string) => void;
  setActivePage: (pageId: string) => void;
  addPage: () => string;
  renamePage: (pageId: string, name: string) => void;
  duplicatePage: (pageId: string) => string | null;
  deletePage: (pageId: string) => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  updatePageSettings: (
    pageId: string,
    updates: Partial<Pick<FlowPage, "background">> & { gridSettings?: Partial<FlowPageGridSettings> },
  ) => void;
  captureActivePageViewport: (viewport: FlowPageViewport) => void;
  addLayer: (name?: string) => string;
  renameLayer: (layerId: string, name: string) => void;
  deleteLayer: (layerId: string) => void;
  reorderLayers: (fromIndex: number, toIndex: number) => void;
  toggleLayerVisibility: (layerId: string, visible: boolean) => void;
  toggleLayerLocked: (layerId: string, locked: boolean) => void;
  assignSelectionToLayer: (layerId: string | undefined) => void;
  nudgeSelected: (dx: number, dy: number) => void;
  history: UseFlowHistoryResult<FlowDefinition>;
}

function findPage(flow: FlowDefinition, pageId: string): FlowPage | undefined {
  return flow.pages.find((page) => page.id === pageId);
}

function withEdgesPrunedForNodes(page: FlowPage): FlowPage {
  const nodeIds = new Set(page.nodes.map((n) => n.id));
  const edges = page.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
  return edges.length === page.edges.length ? page : { ...page, edges };
}

function updatePage(
  flow: FlowDefinition,
  pageId: string,
  updater: (page: FlowPage) => FlowPage,
): FlowDefinition {
  return {
    ...flow,
    pages: flow.pages.map((page) => (page.id === pageId ? updater(page) : page)),
  };
}

function resolveActivePageId(flow: FlowDefinition): string {
  const first = flow.pages[0];
  if (!first) {
    throw new Error("FlowDefinition must have at least one page.");
  }
  if (flow.activePageId && findPage(flow, flow.activePageId)) {
    return flow.activePageId;
  }
  return first.id;
}

export function useFlowState(initialFlow: FlowDefinition): UseFlowStateResult {
  const history = useFlowHistory<FlowDefinition>(initialFlow, { maxSize: 50 });
  const flow = history.present;
  const activePageId = resolveActivePageId(flow);
  const activePage = findPage(flow, activePageId) as FlowPage;

  // rfNodes/rfEdges are React Flow's OWN live state, not re-derived from the
  // domain model on every render. React Flow attaches internal metadata to
  // node objects (most importantly `measured` width/height, set via its own
  // ResizeObserver) that edges rely on to compute their paths. Rebuilding
  // the node array from the active page's nodes on every change would strip
  // that metadata and edges would never render. Instead, `flow`
  // (history.present) is only used to seed/reset this state (including on an
  // active-page switch), and to carry committed snapshots for undo/redo,
  // export, and consumer callbacks.
  const [rfNodes, setRfNodes] = useState<RFNode[]>(() => activePage.nodes.map(toRFNode));
  const [rfEdges, setRfEdges] = useState<RFEdge[]>(() => activePage.edges.map(toRFEdge));

  const lastSyncedFlowRef = useRef<FlowDefinition>(initialFlow);
  const lastSyncedPageIdRef = useRef<string>(activePageId);

  useEffect(() => {
    const flowChanged = flow !== lastSyncedFlowRef.current;
    const pageChanged = activePageId !== lastSyncedPageIdRef.current;
    if (flowChanged || pageChanged) {
      setRfNodes(activePage.nodes.map(toRFNode));
      setRfEdges(activePage.edges.map(toRFEdge));
      lastSyncedFlowRef.current = flow;
      lastSyncedPageIdRef.current = activePageId;
    }
  }, [flow, activePageId, activePage]);

  const commitFlow = useCallback(
    (next: FlowDefinition) => {
      lastSyncedFlowRef.current = next;
      history.commit(next);
    },
    [history],
  );

  const selectedNodeIds = useMemo(
    () => rfNodes.filter((node) => node.selected).map((node) => node.id),
    [rfNodes],
  );
  const selectedEdgeIds = useMemo(
    () => rfEdges.filter((edge) => edge.selected).map((edge) => edge.id),
    [rfEdges],
  );
  const selectedNodeId = selectedNodeIds[0] ?? null;
  const selectedEdgeId = selectedEdgeIds[0] ?? null;

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

      const nextFlow = updatePage(flow, activePageId, (page) =>
        withEdgesPrunedForNodes({ ...page, nodes: nextRFNodes.map(fromRFNode) }),
      );
      commitFlow(nextFlow);
    },
    [flow, activePageId, rfNodes, commitFlow],
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

      const nextFlow = updatePage(flow, activePageId, (page) => ({
        ...page,
        edges: nextRFEdges.map(fromRFEdge),
      }));
      commitFlow(nextFlow);
    },
    [flow, activePageId, rfEdges, commitFlow],
  );

  const onConnect = useCallback<UseFlowStateResult["onConnect"]>(
    (connection) => {
      if (!connection.source || !connection.target) return;
      const newEdge: FlowEdge = {
        id: generateId("edge"),
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
        lineStyle: "solid",
        arrow: "forward",
        routing: "curved",
      };
      setRfEdges((current) => [...current, toRFEdge(newEdge)]);
      commitFlow(
        updatePage(flow, activePageId, (page) => ({ ...page, edges: [...page.edges, newEdge] })),
      );
    },
    [flow, activePageId, commitFlow],
  );

  const addNode = useCallback<UseFlowStateResult["addNode"]>(
    (type, position, label) => {
      const id = generateId("node");
      const defaultStyle = readDefaultNodeStyle();
      const newNode: FlowNode = {
        id,
        type,
        position,
        data: { label: plainTextToRichText(label) },
        ...(defaultStyle ? { style: defaultStyle } : {}),
      };
      setRfNodes((current) => [
        ...current.map((node) => ({ ...node, selected: false })),
        { ...toRFNode(newNode), selected: true },
      ]);
      setRfEdges((current) => current.map((edge) => ({ ...edge, selected: false })));
      commitFlow(
        updatePage(flow, activePageId, (page) => ({ ...page, nodes: [...page.nodes, newNode] })),
      );
      return id;
    },
    [flow, activePageId, commitFlow],
  );

  const duplicateNode = useCallback<UseFlowStateResult["duplicateNode"]>(
    (nodeId) => {
      const source = activePage.nodes.find((node) => node.id === nodeId);
      if (!source) return null;
      const id = generateId("node");
      const newNode: FlowNode = {
        ...source,
        id,
        position: { x: source.position.x + 32, y: source.position.y + 32 },
        data: { ...source.data },
      };
      setRfNodes((current) => [
        ...current.map((node) => ({ ...node, selected: false })),
        { ...toRFNode(newNode), selected: true },
      ]);
      setRfEdges((current) => current.map((edge) => ({ ...edge, selected: false })));
      commitFlow(
        updatePage(flow, activePageId, (page) => ({ ...page, nodes: [...page.nodes, newNode] })),
      );
      return id;
    },
    [flow, activePageId, activePage, commitFlow],
  );

  const duplicateSelected = useCallback<UseFlowStateResult["duplicateSelected"]>(() => {
    if (selectedNodeIds.length === 0) return;
    const idSet = new Set(selectedNodeIds);
    const sources = activePage.nodes.filter((node) => idSet.has(node.id));
    const newNodes: FlowNode[] = sources.map((source) => ({
      ...source,
      id: generateId("node"),
      position: { x: source.position.x + 32, y: source.position.y + 32 },
      data: { ...source.data },
    }));
    setRfNodes((current) => [
      ...current.map((node) => ({ ...node, selected: false })),
      ...newNodes.map((node) => ({ ...toRFNode(node), selected: true })),
    ]);
    setRfEdges((current) => current.map((edge) => ({ ...edge, selected: false })));
    commitFlow(
      updatePage(flow, activePageId, (page) => ({ ...page, nodes: [...page.nodes, ...newNodes] })),
    );
  }, [flow, activePageId, activePage, selectedNodeIds, commitFlow]);

  const updateNodeData = useCallback<UseFlowStateResult["updateNodeData"]>(
    (nodeId, data) => {
      setRfNodes((current) =>
        current.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node,
        ),
      );
      const nextFlow = updatePage(flow, activePageId, (page) => ({
        ...page,
        nodes: page.nodes.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node,
        ),
      }));
      scheduleTextCommit(`node:${nodeId}`, nextFlow);
    },
    [flow, activePageId, scheduleTextCommit],
  );

  const updateEdgeLabel = useCallback<UseFlowStateResult["updateEdgeLabel"]>(
    (edgeId, label) => {
      const plainLabel = richTextToPlainText(label);
      setRfEdges((current) =>
        current.map((edge) => (edge.id === edgeId ? { ...edge, label: plainLabel } : edge)),
      );
      const nextFlow = updatePage(flow, activePageId, (page) => ({
        ...page,
        edges: page.edges.map((edge) => (edge.id === edgeId ? { ...edge, label } : edge)),
      }));
      scheduleTextCommit(`edge:${edgeId}`, nextFlow);
    },
    [flow, activePageId, scheduleTextCommit],
  );

  const updateEdgeStyle = useCallback<UseFlowStateResult["updateEdgeStyle"]>(
    (edgeId, updates) => {
      const nextEdges = activePage.edges.map((edge) =>
        edge.id === edgeId ? { ...edge, ...updates } : edge,
      );
      setRfEdges((current) =>
        current.map((edge) => {
          if (edge.id !== edgeId) return edge;
          const domainEdge = nextEdges.find((e) => e.id === edgeId);
          return domainEdge ? { ...toRFEdge(domainEdge), selected: edge.selected } : edge;
        }),
      );
      commitFlow(updatePage(flow, activePageId, (page) => ({ ...page, edges: nextEdges })));
    },
    [flow, activePageId, activePage, commitFlow],
  );

  const updateNodeStyle = useCallback<UseFlowStateResult["updateNodeStyle"]>(
    (nodeId, updates) => {
      const nextNodes = activePage.nodes.map((node) =>
        node.id === nodeId ? { ...node, style: { ...node.style, ...updates } } : node,
      );
      setRfNodes((current) =>
        current.map((node) => {
          if (node.id !== nodeId) return node;
          const domainNode = nextNodes.find((n) => n.id === nodeId);
          return domainNode ? { ...toRFNode(domainNode), selected: node.selected } : node;
        }),
      );
      commitFlow(updatePage(flow, activePageId, (page) => ({ ...page, nodes: nextNodes })));
    },
    [flow, activePageId, activePage, commitFlow],
  );

  const updateNodePosition = useCallback<UseFlowStateResult["updateNodePosition"]>(
    (nodeId, position) => {
      const nextNodes = activePage.nodes.map((node) =>
        node.id === nodeId ? { ...node, position } : node,
      );
      setRfNodes((current) =>
        current.map((node) => (node.id === nodeId ? { ...node, position } : node)),
      );
      commitFlow(updatePage(flow, activePageId, (page) => ({ ...page, nodes: nextNodes })));
    },
    [flow, activePageId, activePage, commitFlow],
  );

  const updateNodeSize = useCallback<UseFlowStateResult["updateNodeSize"]>(
    (nodeId, width, height) => {
      const nextNodes = activePage.nodes.map((node) =>
        node.id === nodeId ? { ...node, width, height } : node,
      );
      setRfNodes((current) =>
        current.map((node) => (node.id === nodeId ? { ...node, width, height } : node)),
      );
      commitFlow(updatePage(flow, activePageId, (page) => ({ ...page, nodes: nextNodes })));
    },
    [flow, activePageId, activePage, commitFlow],
  );

  const setNodeRotation = useCallback<UseFlowStateResult["setNodeRotation"]>(
    (nodeId, degrees) => {
      const nextNodes = activePage.nodes.map((node) =>
        node.id === nodeId ? { ...node, style: { ...node.style, rotation: degrees } } : node,
      );
      setRfNodes((current) =>
        current.map((node) => {
          if (node.id !== nodeId) return node;
          const domainNode = nextNodes.find((n) => n.id === nodeId);
          return domainNode ? { ...toRFNode(domainNode), selected: node.selected } : node;
        }),
      );
      commitFlow(updatePage(flow, activePageId, (page) => ({ ...page, nodes: nextNodes })));
    },
    [flow, activePageId, activePage, commitFlow],
  );

  const applyStyleToSelection = useCallback<UseFlowStateResult["applyStyleToSelection"]>(
    (updates) => {
      let nextPage = activePage;
      if (updates.node && selectedNodeIds.length > 0) {
        const nodeIdSet = new Set(selectedNodeIds);
        nextPage = {
          ...nextPage,
          nodes: nextPage.nodes.map((node) =>
            nodeIdSet.has(node.id) ? { ...node, style: { ...node.style, ...updates.node } } : node,
          ),
        };
      }
      if (updates.edge && selectedEdgeIds.length > 0) {
        const edgeIdSet = new Set(selectedEdgeIds);
        nextPage = {
          ...nextPage,
          edges: nextPage.edges.map((edge) =>
            edgeIdSet.has(edge.id) ? { ...edge, ...updates.edge } : edge,
          ),
        };
      }
      if (nextPage === activePage) return;
      setRfNodes(nextPage.nodes.map((node) => {
        const rfNode = rfNodes.find((n) => n.id === node.id);
        return rfNode ? { ...toRFNode(node), selected: rfNode.selected } : toRFNode(node);
      }));
      setRfEdges(nextPage.edges.map((edge) => {
        const rfEdge = rfEdges.find((e) => e.id === edge.id);
        return rfEdge ? { ...toRFEdge(edge), selected: rfEdge.selected } : toRFEdge(edge);
      }));
      commitFlow(updatePage(flow, activePageId, () => nextPage));
    },
    [flow, activePageId, activePage, rfNodes, rfEdges, selectedNodeIds, selectedEdgeIds, commitFlow],
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

      const nextFlow = updatePage(flow, activePageId, (page) =>
        withEdgesPrunedForNodes({
          ...page,
          nodes: page.nodes.filter((node) => !nodeIdSet.has(node.id)),
          edges: page.edges.filter((edge) => !edgeIdSet.has(edge.id)),
        }),
      );
      commitFlow(nextFlow);
    },
    [flow, activePageId, commitFlow],
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

  const selectAll = useCallback(() => {
    setRfNodes((current) => current.map((node) => ({ ...node, selected: true })));
    setRfEdges((current) => current.map((edge) => ({ ...edge, selected: true })));
  }, []);

  const replaceFlow = useCallback<UseFlowStateResult["replaceFlow"]>(
    (next) => {
      history.reset(next);
    },
    [history],
  );

  const reorderNode = useCallback(
    (nodeId: string, toFront: boolean) => {
      const target = activePage.nodes.find((node) => node.id === nodeId);
      if (!target) return;
      const rest = activePage.nodes.filter((node) => node.id !== nodeId);
      const nextNodes = toFront ? [...rest, target] : [target, ...rest];
      setRfNodes((current) => {
        const targetRf = current.find((node) => node.id === nodeId);
        if (!targetRf) return current;
        const restRf = current.filter((node) => node.id !== nodeId);
        return toFront ? [...restRf, targetRf] : [targetRf, ...restRf];
      });
      commitFlow(updatePage(flow, activePageId, (page) => ({ ...page, nodes: nextNodes })));
    },
    [flow, activePageId, activePage, commitFlow],
  );

  const bringToFront = useCallback<UseFlowStateResult["bringToFront"]>(
    (nodeId) => reorderNode(nodeId, true),
    [reorderNode],
  );

  const sendToBack = useCallback<UseFlowStateResult["sendToBack"]>(
    (nodeId) => reorderNode(nodeId, false),
    [reorderNode],
  );

  const groupSelected = useCallback<UseFlowStateResult["groupSelected"]>(() => {
    if (selectedNodeIds.length < 2) return;
    const groupId = generateId("group");
    const nodeIdSet = new Set(selectedNodeIds);
    const nextFlow = updatePage(flow, activePageId, (page) => ({
      ...page,
      nodes: page.nodes.map((node) =>
        nodeIdSet.has(node.id) ? { ...node, data: { ...node.data, groupId } } : node,
      ),
    }));
    setRfNodes((current) =>
      current.map((node) =>
        nodeIdSet.has(node.id) ? { ...node, data: { ...node.data, groupId } } : node,
      ),
    );
    commitFlow(nextFlow);
  }, [flow, activePageId, selectedNodeIds, commitFlow]);

  const ungroupSelected = useCallback<UseFlowStateResult["ungroupSelected"]>(() => {
    if (selectedNodeIds.length === 0) return;
    const nodeIdSet = new Set(selectedNodeIds);
    const nextFlow = updatePage(flow, activePageId, (page) => ({
      ...page,
      nodes: page.nodes.map((node) => {
        if (!nodeIdSet.has(node.id)) return node;
        const { groupId: _groupId, ...rest } = node.data;
        return { ...node, data: rest };
      }),
    }));
    setRfNodes((current) =>
      current.map((node) => {
        if (!nodeIdSet.has(node.id)) return node;
        const { groupId: _groupId, ...rest } = node.data;
        return { ...node, data: rest };
      }),
    );
    commitFlow(nextFlow);
  }, [flow, activePageId, selectedNodeIds, commitFlow]);

  const selectedNodesSnapshot = useCallback(
    () => activePage.nodes.filter((node) => selectedNodeIds.includes(node.id)),
    [activePage, selectedNodeIds],
  );

  const applyPositions = useCallback(
    (positions: Map<string, FlowPosition>) => {
      const nextFlow = updatePage(flow, activePageId, (page) => ({
        ...page,
        nodes: page.nodes.map((node) => {
          const position = positions.get(node.id);
          return position ? { ...node, position } : node;
        }),
      }));
      setRfNodes((current) =>
        current.map((node) => {
          const position = positions.get(node.id);
          return position ? { ...node, position } : node;
        }),
      );
      commitFlow(nextFlow);
    },
    [flow, activePageId, commitFlow],
  );

  const alignSelected = useCallback<UseFlowStateResult["alignSelected"]>(
    (edge) => {
      const selected = selectedNodesSnapshot();
      if (selected.length < 2) return;
      const xs = selected.map((node) => node.position.x);
      const ys = selected.map((node) => node.position.y);
      const positions = new Map<string, FlowPosition>();
      const targetForEdge: Record<FlowAlignEdge, (node: FlowNode) => FlowPosition> = {
        left: (node) => ({ x: Math.min(...xs), y: node.position.y }),
        right: (node) => ({ x: Math.max(...xs), y: node.position.y }),
        center: (node) => ({
          x: (Math.min(...xs) + Math.max(...xs)) / 2,
          y: node.position.y,
        }),
        top: (node) => ({ x: node.position.x, y: Math.min(...ys) }),
        bottom: (node) => ({ x: node.position.x, y: Math.max(...ys) }),
        middle: (node) => ({
          x: node.position.x,
          y: (Math.min(...ys) + Math.max(...ys)) / 2,
        }),
      };
      for (const node of selected) {
        positions.set(node.id, targetForEdge[edge](node));
      }
      applyPositions(positions);
    },
    [selectedNodesSnapshot, applyPositions],
  );

  const distributeSelected = useCallback<UseFlowStateResult["distributeSelected"]>(
    (axis) => {
      const selected = selectedNodesSnapshot();
      if (selected.length < 3) return;
      const key = axis === "horizontal" ? "x" : "y";
      const sorted = [...selected].sort((a, b) => a.position[key] - b.position[key]);
      const firstNode = sorted[0];
      const lastNode = sorted[sorted.length - 1];
      if (!firstNode || !lastNode) return;
      const first = firstNode.position[key];
      const last = lastNode.position[key];
      const step = (last - first) / (sorted.length - 1);
      const positions = new Map<string, FlowPosition>();
      sorted.forEach((node, index) => {
        const value = first + step * index;
        positions.set(
          node.id,
          axis === "horizontal" ? { x: value, y: node.position.y } : { x: node.position.x, y: value },
        );
      });
      applyPositions(positions);
    },
    [selectedNodesSnapshot, applyPositions],
  );

  const rotateSelected = useCallback<UseFlowStateResult["rotateSelected"]>(
    (degrees) => {
      const selected = selectedNodesSnapshot();
      if (selected.length === 0) return;
      const nodeIdSet = new Set(selected.map((node) => node.id));
      const nextFlow = updatePage(flow, activePageId, (page) => ({
        ...page,
        nodes: page.nodes.map((node) => {
          if (!nodeIdSet.has(node.id)) return node;
          const current = node.style?.rotation ?? 0;
          return { ...node, style: { ...node.style, rotation: (current + degrees) % 360 } };
        }),
      }));
      setRfNodes((current) =>
        current.map((node) => {
          if (!nodeIdSet.has(node.id)) return node;
          const domainNode = findPage(nextFlow, activePageId)?.nodes.find((n) => n.id === node.id);
          return domainNode ? { ...toRFNode(domainNode), selected: node.selected } : node;
        }),
      );
      commitFlow(nextFlow);
    },
    [flow, activePageId, selectedNodesSnapshot, commitFlow],
  );

  const flipSelected = useCallback<UseFlowStateResult["flipSelected"]>(
    (axis) => {
      const selected = selectedNodesSnapshot();
      if (selected.length === 0) return;
      const xs = selected.map((node) => node.position.x);
      const ys = selected.map((node) => node.position.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const positions = new Map<string, FlowPosition>();
      for (const node of selected) {
        positions.set(
          node.id,
          axis === "horizontal"
            ? { x: minX + maxX - node.position.x, y: node.position.y }
            : { x: node.position.x, y: minY + maxY - node.position.y },
        );
      }
      applyPositions(positions);
    },
    [selectedNodesSnapshot, applyPositions],
  );

  const setLockedForNodeIds = useCallback(
    (nodeIds: string[], locked: boolean) => {
      if (nodeIds.length === 0) return;
      const nodeIdSet = new Set(nodeIds);
      const nextFlow = updatePage(flow, activePageId, (page) => ({
        ...page,
        nodes: page.nodes.map((node) => (nodeIdSet.has(node.id) ? { ...node, locked } : node)),
      }));
      setRfNodes((current) =>
        current.map((node) =>
          nodeIdSet.has(node.id) ? { ...node, draggable: locked ? false : undefined } : node,
        ),
      );
      commitFlow(nextFlow);
    },
    [flow, activePageId, commitFlow],
  );

  const setLockedForSelection = useCallback(
    (locked: boolean) => setLockedForNodeIds(selectedNodeIds, locked),
    [setLockedForNodeIds, selectedNodeIds],
  );

  const lockSelected = useCallback<UseFlowStateResult["lockSelected"]>(
    () => setLockedForSelection(true),
    [setLockedForSelection],
  );

  const unlockSelected = useCallback<UseFlowStateResult["unlockSelected"]>(
    () => setLockedForSelection(false),
    [setLockedForSelection],
  );

  const toggleNodeLock = useCallback<UseFlowStateResult["toggleNodeLock"]>(
    (nodeId) => {
      const node = activePage.nodes.find((candidate) => candidate.id === nodeId);
      if (!node) return;
      setLockedForNodeIds([nodeId], !node.locked);
    },
    [activePage, setLockedForNodeIds],
  );

  const setActivePage = useCallback<UseFlowStateResult["setActivePage"]>(
    (pageId) => {
      if (!findPage(flow, pageId) || pageId === activePageId) return;
      commitFlow({ ...flow, activePageId: pageId });
    },
    [flow, activePageId, commitFlow],
  );

  const addPage = useCallback<UseFlowStateResult["addPage"]>(() => {
    const id = generateId("page");
    const newPage: FlowPage = {
      id,
      name: `Page ${flow.pages.length + 1}`,
      nodes: [],
      edges: [],
    };
    commitFlow({ ...flow, pages: [...flow.pages, newPage], activePageId: id });
    return id;
  }, [flow, commitFlow]);

  const renamePage = useCallback<UseFlowStateResult["renamePage"]>(
    (pageId, name) => {
      if (!findPage(flow, pageId)) return;
      commitFlow(updatePage(flow, pageId, (page) => ({ ...page, name })));
    },
    [flow, commitFlow],
  );

  const duplicatePage = useCallback<UseFlowStateResult["duplicatePage"]>(
    (pageId) => {
      const source = findPage(flow, pageId);
      if (!source) return null;
      const id = generateId("page");
      const idMap = new Map(source.nodes.map((node) => [node.id, generateId("node")]));
      const newPage: FlowPage = {
        ...source,
        id,
        name: `${source.name} copy`,
        nodes: source.nodes.map((node) => ({
          ...node,
          id: idMap.get(node.id) as string,
          data: { ...node.data },
        })),
        edges: source.edges.map((edge) => ({
          ...edge,
          id: generateId("edge"),
          source: idMap.get(edge.source) ?? edge.source,
          target: idMap.get(edge.target) ?? edge.target,
        })),
      };
      const sourceIndex = flow.pages.findIndex((page) => page.id === pageId);
      const nextPages = [...flow.pages];
      nextPages.splice(sourceIndex + 1, 0, newPage);
      commitFlow({ ...flow, pages: nextPages, activePageId: id });
      return id;
    },
    [flow, commitFlow],
  );

  const deletePage = useCallback<UseFlowStateResult["deletePage"]>(
    (pageId) => {
      if (flow.pages.length <= 1) return;
      const index = flow.pages.findIndex((page) => page.id === pageId);
      if (index === -1) return;
      const nextPages = flow.pages.filter((page) => page.id !== pageId);
      const nextActivePageId =
        activePageId === pageId
          ? (nextPages[Math.min(index, nextPages.length - 1)] as FlowPage).id
          : activePageId;
      commitFlow({ ...flow, pages: nextPages, activePageId: nextActivePageId });
    },
    [flow, activePageId, commitFlow],
  );

  const reorderPages = useCallback<UseFlowStateResult["reorderPages"]>(
    (fromIndex, toIndex) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= flow.pages.length ||
        toIndex >= flow.pages.length
      ) {
        return;
      }
      const nextPages = [...flow.pages];
      const [moved] = nextPages.splice(fromIndex, 1);
      if (!moved) return;
      nextPages.splice(toIndex, 0, moved);
      commitFlow({ ...flow, pages: nextPages });
    },
    [flow, commitFlow],
  );

  const updatePageSettings = useCallback<UseFlowStateResult["updatePageSettings"]>(
    (pageId, updates) => {
      if (!findPage(flow, pageId)) return;
      commitFlow(
        updatePage(flow, pageId, (page) => ({
          ...page,
          ...(updates.background !== undefined ? { background: updates.background } : {}),
          ...(updates.gridSettings !== undefined
            ? { gridSettings: { ...page.gridSettings, ...updates.gridSettings } }
            : {}),
        })),
      );
    },
    [flow, commitFlow],
  );

  const captureActivePageViewport = useCallback<UseFlowStateResult["captureActivePageViewport"]>(
    (viewport) => {
      history.replacePresent(
        updatePage(flow, activePageId, (page) => ({ ...page, viewport })),
      );
    },
    [flow, activePageId, history],
  );

  const addLayer = useCallback<UseFlowStateResult["addLayer"]>(
    (name) => {
      const id = generateId("layer");
      const layerName = name ?? `Layer ${(activePage.layers?.length ?? 0) + 1}`;
      const newLayer: FlowLayer = { id, name: layerName, visible: true, locked: false };
      commitFlow(
        updatePage(flow, activePageId, (page) => ({
          ...page,
          layers: [...(page.layers ?? []), newLayer],
        })),
      );
      return id;
    },
    [flow, activePageId, activePage, commitFlow],
  );

  const renameLayer = useCallback<UseFlowStateResult["renameLayer"]>(
    (layerId, name) => {
      commitFlow(
        updatePage(flow, activePageId, (page) => ({
          ...page,
          layers: (page.layers ?? []).map((layer) =>
            layer.id === layerId ? { ...layer, name } : layer,
          ),
        })),
      );
    },
    [flow, activePageId, commitFlow],
  );

  const deleteLayer = useCallback<UseFlowStateResult["deleteLayer"]>(
    (layerId) => {
      commitFlow(
        updatePage(flow, activePageId, (page) => ({
          ...page,
          layers: (page.layers ?? []).filter((layer) => layer.id !== layerId),
          nodes: page.nodes.map((node) =>
            node.layerId === layerId ? { ...node, layerId: undefined } : node,
          ),
          edges: page.edges.map((edge) =>
            edge.layerId === layerId ? { ...edge, layerId: undefined } : edge,
          ),
        })),
      );
    },
    [flow, activePageId, commitFlow],
  );

  const reorderLayers = useCallback<UseFlowStateResult["reorderLayers"]>(
    (fromIndex, toIndex) => {
      const layers = activePage.layers ?? [];
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= layers.length ||
        toIndex >= layers.length
      ) {
        return;
      }
      const nextLayers = [...layers];
      const [moved] = nextLayers.splice(fromIndex, 1);
      if (!moved) return;
      nextLayers.splice(toIndex, 0, moved);
      commitFlow(updatePage(flow, activePageId, (page) => ({ ...page, layers: nextLayers })));
    },
    [flow, activePageId, activePage, commitFlow],
  );

  const toggleLayerVisibility = useCallback<UseFlowStateResult["toggleLayerVisibility"]>(
    (layerId, visible) => {
      commitFlow(
        updatePage(flow, activePageId, (page) => ({
          ...page,
          layers: (page.layers ?? []).map((layer) =>
            layer.id === layerId ? { ...layer, visible } : layer,
          ),
        })),
      );
    },
    [flow, activePageId, commitFlow],
  );

  const toggleLayerLocked = useCallback<UseFlowStateResult["toggleLayerLocked"]>(
    (layerId, locked) => {
      commitFlow(
        updatePage(flow, activePageId, (page) => ({
          ...page,
          layers: (page.layers ?? []).map((layer) =>
            layer.id === layerId ? { ...layer, locked } : layer,
          ),
        })),
      );
    },
    [flow, activePageId, commitFlow],
  );

  const assignSelectionToLayer = useCallback<UseFlowStateResult["assignSelectionToLayer"]>(
    (layerId) => {
      if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) return;
      const nodeIdSet = new Set(selectedNodeIds);
      const edgeIdSet = new Set(selectedEdgeIds);
      const nextFlow = updatePage(flow, activePageId, (page) => ({
        ...page,
        nodes: page.nodes.map((node) => (nodeIdSet.has(node.id) ? { ...node, layerId } : node)),
        edges: page.edges.map((edge) => (edgeIdSet.has(edge.id) ? { ...edge, layerId } : edge)),
      }));
      setRfNodes((current) =>
        current.map((node) =>
          nodeIdSet.has(node.id) ? { ...node, data: { ...node.data, layerId } } : node,
        ),
      );
      commitFlow(nextFlow);
    },
    [flow, activePageId, selectedNodeIds, selectedEdgeIds, commitFlow],
  );

  const nudgeSelected = useCallback<UseFlowStateResult["nudgeSelected"]>(
    (dx, dy) => {
      const selected = selectedNodesSnapshot();
      if (selected.length === 0) return;
      const positions = new Map<string, FlowPosition>();
      for (const node of selected) {
        positions.set(node.id, { x: node.position.x + dx, y: node.position.y + dy });
      }
      applyPositions(positions);
    },
    [selectedNodesSnapshot, applyPositions],
  );

  return {
    flow,
    activePageId,
    activePage,
    rfNodes,
    rfEdges,
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    duplicateNode,
    duplicateSelected,
    updateNodeData,
    updateEdgeLabel,
    updateEdgeStyle,
    updateNodeStyle,
    updateNodePosition,
    updateNodeSize,
    setNodeRotation,
    applyStyleToSelection,
    deleteElements,
    deleteSelected,
    clearSelection,
    selectAll,
    replaceFlow,
    bringToFront,
    sendToBack,
    groupSelected,
    ungroupSelected,
    alignSelected,
    distributeSelected,
    rotateSelected,
    flipSelected,
    lockSelected,
    unlockSelected,
    toggleNodeLock,
    setActivePage,
    addPage,
    renamePage,
    duplicatePage,
    deletePage,
    reorderPages,
    updatePageSettings,
    captureActivePageViewport,
    addLayer,
    renameLayer,
    deleteLayer,
    reorderLayers,
    toggleLayerVisibility,
    toggleLayerLocked,
    assignSelectionToLayer,
    nudgeSelected,
    history,
  };
}

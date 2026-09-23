import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { DragEvent, MouseEvent as ReactMouseEvent } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Node as RFNodeType,
  type Edge as RFEdgeType,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type {
  FlowBuilderProps,
  FlowBuilderRef,
  FlowDefinition,
  FlowEdge,
  FlowNodeType,
  RichText,
} from "../../types/flow.types";
import { useFlowState } from "../../hooks/useFlowState";
import { useFlowKeyboard } from "../../hooks/useFlowKeyboard";
import { FlowLabelEditingContext, type FlowLabelEditTarget } from "../../hooks/useFlowLabelEditing";
import { nodeTypes } from "../nodes";
import { NodePalette } from "../NodePalette/NodePalette";
import { PropertiesPanel } from "../PropertiesPanel/PropertiesPanel";
import { Icon, Tooltip } from "../../../../primitives";
import { ContextMenu, type ContextMenuAction } from "../ContextMenu/ContextMenu";
import { TextFormatToolbar, TextFormatControls } from "../TextFormatToolbar/TextFormatToolbar";
import { PageTabs } from "../PageTabs/PageTabs";
import { LayersPanel } from "../LayersPanel/LayersPanel";
import { Rulers } from "../Rulers/Rulers";
import { generateId } from "../../utils/id";
import { exportFlow } from "../../utils/flowExport";
import { exportPageToSVG } from "../../utils/svgExport";
import { exportPageToPNG } from "../../utils/pngExport";
import { fromRFNode, fromRFEdge } from "../../utils/rfAdapters";
import { computeAlignmentGuides, type AlignmentGuide } from "../../utils/alignment";
import "../../styles/flow-builder.css";

const NODE_DRAG_DATA_KEY = "application/wec-flow-node";

const DEFAULT_NODE_LABELS: Record<FlowNodeType, string> = {
  start: "Start",
  end: "End",
  process: "Process",
  decision: "Decision",
  input: "Input",
  output: "Output",
  rectangle: "Rectangle",
  roundedRectangle: "Rounded Rectangle",
  ellipse: "Ellipse",
  diamond: "Diamond",
  parallelogram: "Parallelogram",
  triangle: "Triangle",
  hexagon: "Hexagon",
  cylinder: "Cylinder",
  cloud: "Cloud",
  document: "Document",
  text: "Text",
  container: "Container",
  actor: "Actor",
  package: "Package",
  note: "Note",
};

function createEmptyFlow(): FlowDefinition {
  const pageId = generateId("page");
  return {
    id: generateId("flow"),
    name: "Untitled Flow",
    pages: [{ id: pageId, name: "Page 1", nodes: [], edges: [] }],
    activePageId: pageId,
  };
}

interface FlowBuilderInnerProps extends FlowBuilderProps {
  initialFlowForState: FlowDefinition;
}

const FlowBuilderInner = forwardRef<FlowBuilderRef, FlowBuilderInnerProps>(
  function FlowBuilderInner(
    {
      initialFlowForState,
      value,
      onChange,
      onNodeSelect,
      onEdgeSelect,
      onZoomChange,
      readonly = false,
      showNodePalette = true,
      showPropertiesPanel = true,
      showControls = true,
      showMiniMap = false,
      height = 600,
      className,
    },
    ref,
  ) {
    const flowState = useFlowState(initialFlowForState);
    const reactFlowInstance = useReactFlow();
    const wrapperRef = useRef<HTMLDivElement>(null);
    const lastEmittedRef = useRef<FlowDefinition | null>(initialFlowForState);
    const isFirstRenderRef = useRef(true);
    const [dragPreview, setDragPreview] = useState<{
      type: FlowNodeType;
      left: number;
      top: number;
    } | null>(null);
    const [contextMenu, setContextMenu] = useState<{
      left: number;
      top: number;
      target: { kind: "node"; id: string } | { kind: "edge"; id: string } | { kind: "pane" };
    } | null>(null);
    const [gridVisible, setGridVisible] = useState(true);
    const [rulersVisible, setRulersVisible] = useState(false);
    const [outlineVisible, setOutlineVisible] = useState(showMiniMap);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [layersPanelOpen, setLayersPanelOpen] = useState(false);
    const [propertiesPanelCollapsed, setPropertiesPanelCollapsed] = useState(false);
    const [paletteCollapsed, setPaletteCollapsed] = useState(false);
    const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
    const [editingTarget, setEditingTarget] = useState<FlowLabelEditTarget | null>(null);
    const [viewportState, setViewportState] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });

    // Controlled-mode sync: replace internal state when an externally supplied
    // `value` changes to something other than what we ourselves last emitted.
    useEffect(() => {
      if (value !== undefined && value !== lastEmittedRef.current) {
        flowState.replaceFlow(value);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    useEffect(() => {
      if (isFirstRenderRef.current) {
        isFirstRenderRef.current = false;
        return;
      }
      lastEmittedRef.current = flowState.flow;
      onChange?.(flowState.flow);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flowState.flow]);

    // Sourced from rfNodes/rfEdges (not flow.nodes/flow.edges): those update
    // immediately on every keystroke, while flow only updates on debounced
    // commit, so reading from flow here would make the Properties Panel's
    // controlled inputs fight the user's typing.
    const selectedNode = useMemo(() => {
      const rfNode = flowState.rfNodes.find((node) => node.id === flowState.selectedNodeId);
      return rfNode ? fromRFNode(rfNode) : null;
    }, [flowState.rfNodes, flowState.selectedNodeId]);
    const selectedEdge = useMemo(() => {
      const rfEdge = flowState.rfEdges.find((edge) => edge.id === flowState.selectedEdgeId);
      return rfEdge ? fromRFEdge(rfEdge) : null;
    }, [flowState.rfEdges, flowState.selectedEdgeId]);
    const selectedNodes = useMemo(
      () =>
        flowState.rfNodes
          .filter((node) => flowState.selectedNodeIds.includes(node.id))
          .map(fromRFNode),
      [flowState.rfNodes, flowState.selectedNodeIds],
    );
    const selectedEdges = useMemo(
      () =>
        flowState.rfEdges
          .filter((edge) => flowState.selectedEdgeIds.includes(edge.id))
          .map(fromRFEdge),
      [flowState.rfEdges, flowState.selectedEdgeIds],
    );

    const lastRestoredPageIdRef = useRef<string | null>(null);

    useEffect(() => {
      if (lastRestoredPageIdRef.current === flowState.activePageId) return;
      lastRestoredPageIdRef.current = flowState.activePageId;
      const viewport = flowState.activePage.viewport;
      if (viewport) {
        reactFlowInstance.setViewport(viewport);
      } else {
        reactFlowInstance.fitView();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flowState.activePageId]);

    const handleSelectPage = useCallback(
      (pageId: string) => {
        if (pageId === flowState.activePageId) return;
        flowState.captureActivePageViewport(reactFlowInstance.getViewport());
        flowState.setActivePage(pageId);
      },
      [flowState, reactFlowInstance],
    );

    useEffect(() => {
      onNodeSelect?.(selectedNode);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedNode]);

    useEffect(() => {
      onEdgeSelect?.(selectedEdge);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEdge]);

    const handleConnect = useCallback(
      (connection: Connection) => {
        if (readonly) return;
        flowState.onConnect(connection);
      },
      [readonly, flowState],
    );

    const [connectingHandles, setConnectingHandles] = useState(false);
    const handleConnectStart = useCallback(() => setConnectingHandles(true), []);
    const handleConnectEnd = useCallback(() => setConnectingHandles(false), []);

    const draggedTypeRef = useRef<FlowNodeType | null>(null);

    const handlePaletteDragStart = useCallback((type: FlowNodeType) => {
      draggedTypeRef.current = type;
    }, []);

    const handlePaletteDragEnd = useCallback(() => {
      draggedTypeRef.current = null;
      setDragPreview(null);
    }, []);

    const handleDragOver = useCallback(
      (event: DragEvent<HTMLDivElement>) => {
        if (readonly) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const type = draggedTypeRef.current;
        const wrapper = wrapperRef.current;
        if (!type || !wrapper) return;
        const bounds = wrapper.getBoundingClientRect();
        setDragPreview({
          type,
          left: event.clientX - bounds.left,
          top: event.clientY - bounds.top,
        });
      },
      [readonly],
    );

    const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
      setDragPreview(null);
    }, []);

    const handleDrop = useCallback(
      (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        draggedTypeRef.current = null;
        setDragPreview(null);
        if (readonly) return;
        const type = event.dataTransfer.getData(NODE_DRAG_DATA_KEY) as FlowNodeType | "";
        if (!type) return;
        const position = reactFlowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        flowState.addNode(type, position, DEFAULT_NODE_LABELS[type]);
      },
      [readonly, reactFlowInstance, flowState],
    );

    const handleUpdateEdge = useCallback(
      (
        edgeId: string,
        updates: Partial<
          Pick<FlowEdge, "label" | "lineStyle" | "arrow" | "arrowStart" | "arrowEnd">
        >,
      ) => {
        if (updates.label !== undefined) {
          flowState.updateEdgeLabel(edgeId, updates.label);
        }
        if (
          updates.lineStyle !== undefined ||
          updates.arrow !== undefined ||
          updates.arrowStart !== undefined ||
          updates.arrowEnd !== undefined
        ) {
          flowState.updateEdgeStyle(edgeId, {
            lineStyle: updates.lineStyle,
            arrow: updates.arrow,
            arrowStart: updates.arrowStart,
            arrowEnd: updates.arrowEnd,
          });
        }
      },
      [flowState],
    );

    const startLabelEdit = useCallback(
      (target: FlowLabelEditTarget) => {
        if (readonly) return;
        setEditingTarget(target);
      },
      [readonly],
    );

    const commitLabelEdit = useCallback(
      (label: RichText) => {
        if (editingTarget?.kind === "node") {
          flowState.updateNodeData(editingTarget.id, { label });
        } else if (editingTarget?.kind === "edge") {
          flowState.updateEdgeLabel(editingTarget.id, label);
        }
        setEditingTarget(null);
      },
      [editingTarget, flowState],
    );

    const labelEditingContextValue = useMemo(
      () => ({
        editingTarget,
        startEdit: startLabelEdit,
        commitEdit: commitLabelEdit,
        readonly,
        resizeNode: flowState.updateNodeSize,
        rotateNode: flowState.setNodeRotation,
      }),
      [
        editingTarget,
        startLabelEdit,
        commitLabelEdit,
        readonly,
        flowState.updateNodeSize,
        flowState.setNodeRotation,
      ],
    );

    const editingNode = useMemo(() => {
      if (editingTarget?.kind !== "node") return null;
      return selectedNodes.find((node) => node.id === editingTarget.id) ?? null;
    }, [editingTarget, selectedNodes]);

    const handleUpdateNodeStyleSelection = useCallback(
      (updates: Parameters<typeof flowState.applyStyleToSelection>[0]["node"]) => {
        if (readonly) return;
        flowState.applyStyleToSelection({ node: updates });
      },
      [readonly, flowState],
    );

    const handleUpdateEdgeStyleSelection = useCallback(
      (updates: Parameters<typeof flowState.applyStyleToSelection>[0]["edge"]) => {
        if (readonly) return;
        flowState.applyStyleToSelection({ edge: updates });
      },
      [readonly, flowState],
    );

    const handleUpdateNodePosition = useCallback(
      (nodeId: string, x: number, y: number) => {
        if (readonly) return;
        flowState.updateNodePosition(nodeId, { x, y });
      },
      [readonly, flowState],
    );

    const handleUpdateNodeSize = useCallback(
      (nodeId: string, width: number, height: number) => {
        if (readonly) return;
        flowState.updateNodeSize(nodeId, width, height);
      },
      [readonly, flowState],
    );

    const handleDuplicateNode = useCallback(
      (nodeId: string) => {
        if (!readonly) flowState.duplicateNode(nodeId);
      },
      [readonly, flowState],
    );

    const handleDeleteNode = useCallback(
      (nodeId: string) => {
        if (!readonly) flowState.deleteElements([nodeId], []);
      },
      [readonly, flowState],
    );

    const handleDeleteEdge = useCallback(
      (edgeId: string) => {
        if (!readonly) flowState.deleteElements([], [edgeId]);
      },
      [readonly, flowState],
    );

    const contextMenuOriginRef = useRef<{ x: number; y: number } | null>(null);

    const openContextMenu = useCallback(
      (
        event: { preventDefault: () => void; clientX: number; clientY: number },
        target: NonNullable<typeof contextMenu>["target"],
      ) => {
        if (readonly) return;
        event.preventDefault();
        const wrapper = wrapperRef.current;
        if (!wrapper) return;
        const bounds = wrapper.getBoundingClientRect();
        contextMenuOriginRef.current = { x: event.clientX, y: event.clientY };
        setContextMenu({
          left: event.clientX - bounds.left,
          top: event.clientY - bounds.top,
          target,
        });
      },
      [readonly],
    );

    const handleNodeContextMenu = useCallback(
      (event: ReactMouseEvent, node: RFNodeType) => {
        openContextMenu(event, { kind: "node", id: node.id });
      },
      [openContextMenu],
    );

    const handleEdgeContextMenu = useCallback(
      (event: ReactMouseEvent, edge: RFEdgeType) => {
        openContextMenu(event, { kind: "edge", id: edge.id });
      },
      [openContextMenu],
    );

    const handlePaneContextMenu = useCallback(
      (event: ReactMouseEvent | MouseEvent) => {
        openContextMenu(event, { kind: "pane" });
      },
      [openContextMenu],
    );

    const closeContextMenu = useCallback(() => {
      setContextMenu(null);
    }, []);

    const handleAddNodeAtMenu = useCallback(
      (type: FlowNodeType) => {
        const origin = contextMenuOriginRef.current;
        if (!origin) return;
        const position = reactFlowInstance.screenToFlowPosition(origin);
        flowState.addNode(type, position, DEFAULT_NODE_LABELS[type]);
      },
      [reactFlowInstance, flowState],
    );

    const handlePaneDoubleClick = useCallback(
      (event: ReactMouseEvent<HTMLDivElement>) => {
        if (readonly) return;
        const target = event.target as HTMLElement;
        if (!target.classList.contains("react-flow__pane")) return;
        const position = reactFlowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        const id = flowState.addNode("rectangle", position, DEFAULT_NODE_LABELS.rectangle);
        setEditingTarget({ kind: "node", id });
      },
      [readonly, reactFlowInstance, flowState],
    );

    const contextMenuActions = useMemo<ContextMenuAction[]>(() => {
      if (!contextMenu) return [];
      if (contextMenu.target.kind === "node") {
        const nodeId = contextMenu.target.id;
        const node = flowState.activePage.nodes.find((candidate) => candidate.id === nodeId);
        return [
          { key: "duplicate", label: "Duplicate node", onSelect: () => flowState.duplicateNode(nodeId) },
          { key: "bring-to-front", label: "Bring to Front", onSelect: () => flowState.bringToFront(nodeId) },
          { key: "send-to-back", label: "Send to Back", onSelect: () => flowState.sendToBack(nodeId) },
          {
            key: "toggle-lock",
            label: node?.locked ? "Unlock node" : "Lock node",
            onSelect: () => flowState.toggleNodeLock(nodeId),
          },
          {
            key: "delete",
            label: "Delete node",
            danger: true,
            onSelect: () => flowState.deleteElements([nodeId], []),
          },
        ];
      }
      if (contextMenu.target.kind === "edge") {
        const edgeId = contextMenu.target.id;
        return [
          {
            key: "delete",
            label: "Delete connection",
            danger: true,
            onSelect: () => flowState.deleteElements([], [edgeId]),
          },
        ];
      }
      return (Object.keys(DEFAULT_NODE_LABELS) as FlowNodeType[]).map((type) => ({
        key: `add-${type}`,
        label: `Add ${DEFAULT_NODE_LABELS[type]} node`,
        onSelect: () => handleAddNodeAtMenu(type),
      }));
    }, [contextMenu, flowState, handleAddNodeAtMenu]);

    const handleMove = useCallback(
      (_event: unknown, viewport: Viewport) => {
        onZoomChange?.(viewport.zoom);
        setViewportState(viewport);
      },
      [onZoomChange],
    );

    const hiddenLayerIds = useMemo(
      () =>
        new Set(
          (flowState.activePage.layers ?? [])
            .filter((layer) => !layer.visible)
            .map((layer) => layer.id),
        ),
      [flowState.activePage.layers],
    );
    const lockedLayerIds = useMemo(
      () =>
        new Set(
          (flowState.activePage.layers ?? []).filter((layer) => layer.locked).map((layer) => layer.id),
        ),
      [flowState.activePage.layers],
    );

    const visibleRfNodes = useMemo(
      () =>
        flowState.rfNodes
          .filter((node) => {
            const layerId = node.data.layerId;
            return layerId === undefined || !hiddenLayerIds.has(layerId);
          })
          .map((node) => {
            const layerId = node.data.layerId;
            if (layerId !== undefined && lockedLayerIds.has(layerId) && node.draggable !== false) {
              return { ...node, draggable: false };
            }
            return node;
          }),
      [flowState.rfNodes, hiddenLayerIds, lockedLayerIds],
    );

    const visibleRfEdges = useMemo(
      () =>
        flowState.rfEdges.filter((edge) => {
          const layerId = edge.data?.layerId;
          return layerId === undefined || !hiddenLayerIds.has(layerId);
        }),
      [flowState.rfEdges, hiddenLayerIds],
    );

    const handleNodeDrag = useCallback(
      (_event: MouseEvent | TouchEvent, node: RFNodeType) => {
        const others = flowState.rfNodes.filter((candidate) => candidate.id !== node.id);
        const width = node.measured?.width ?? 120;
        const height = node.measured?.height ?? 48;
        const guides = computeAlignmentGuides(
          { id: node.id, x: node.position.x, y: node.position.y, width, height },
          others.map((candidate) => ({
            id: candidate.id,
            x: candidate.position.x,
            y: candidate.position.y,
            width: candidate.measured?.width ?? 120,
            height: candidate.measured?.height ?? 48,
          })),
        );
        setAlignmentGuides(guides);
      },
      [flowState.rfNodes],
    );

    const handleNodeDragStop = useCallback(() => {
      setAlignmentGuides([]);
    }, []);

    const handleNudge = useCallback(
      (dx: number, dy: number) => {
        if (!readonly) flowState.nudgeSelected(dx, dy);
      },
      [readonly, flowState],
    );

    const handleToggleFullscreen = useCallback(() => {
      const wrapper = wrapperRef.current?.closest(".wec-flow-builder") as HTMLElement | null;
      if (!document.fullscreenElement) {
        wrapper?.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    }, []);

    useEffect(() => {
      const handleChange = () => setIsFullscreen(document.fullscreenElement !== null);
      document.addEventListener("fullscreenchange", handleChange);
      return () => document.removeEventListener("fullscreenchange", handleChange);
    }, []);

    const handleDelete = useCallback(() => {
      if (!readonly) flowState.deleteSelected();
    }, [readonly, flowState]);

    const handleUndo = useCallback(() => {
      if (!readonly) flowState.history.undo();
    }, [readonly, flowState]);

    const handleRedo = useCallback(() => {
      if (!readonly) flowState.history.redo();
    }, [readonly, flowState]);

    const handleDuplicateSelected = useCallback(() => {
      if (!readonly) flowState.duplicateSelected();
    }, [readonly, flowState]);

    useFlowKeyboard({
      onDelete: handleDelete,
      onUndo: handleUndo,
      onRedo: handleRedo,
      onEscape: flowState.clearSelection,
      onDuplicate: handleDuplicateSelected,
      onNudge: handleNudge,
      enabled: true,
    });

    useImperativeHandle(
      ref,
      () => ({
        getFlow: () => flowState.flow,
        setFlow: (next: FlowDefinition) => flowState.replaceFlow(next),
        clear: () => flowState.replaceFlow(createEmptyFlow()),
        fitView: () => reactFlowInstance.fitView(),
        exportJSON: () => exportFlow(flowState.flow),
        undo: handleUndo,
        redo: handleRedo,
        canUndo: () => flowState.history.canUndo,
        canRedo: () => flowState.history.canRedo,
        deleteSelected: handleDelete,
        selectAll: () => flowState.selectAll(),
        zoomIn: () => reactFlowInstance.zoomIn(),
        zoomOut: () => reactFlowInstance.zoomOut(),
        resetZoom: () => reactFlowInstance.zoomTo(1),
        getZoom: () => reactFlowInstance.getZoom(),
        isGridVisible: () => gridVisible,
        setGridVisible: (visible: boolean) => setGridVisible(visible),
        bringToFront: (nodeId: string) => flowState.bringToFront(nodeId),
        sendToBack: (nodeId: string) => flowState.sendToBack(nodeId),
        bringSelectedToFront: () => {
          for (const nodeId of flowState.selectedNodeIds) flowState.bringToFront(nodeId);
        },
        sendSelectedToBack: () => {
          for (const nodeId of [...flowState.selectedNodeIds].reverse()) flowState.sendToBack(nodeId);
        },
        groupSelected: () => flowState.groupSelected(),
        ungroupSelected: () => flowState.ungroupSelected(),
        alignSelected: (edge) => flowState.alignSelected(edge),
        distributeSelected: (axis) => flowState.distributeSelected(axis),
        rotateSelected: (degrees) => flowState.rotateSelected(degrees),
        flipSelected: (axis) => flowState.flipSelected(axis),
        lockSelected: () => flowState.lockSelected(),
        unlockSelected: () => flowState.unlockSelected(),
        hasSelection: () => flowState.selectedNodeIds.length > 0 || flowState.selectedEdgeIds.length > 0,
        isSelectionLocked: () =>
          flowState.selectedNodeIds.length > 0 &&
          flowState.selectedNodeIds.every(
            (nodeId) => flowState.activePage.nodes.find((node) => node.id === nodeId)?.locked,
          ),
        getActivePageId: () => flowState.activePageId,
        setActivePageId: (pageId: string) => handleSelectPage(pageId),
        addPage: () => flowState.addPage(),
        isOutlineVisible: () => outlineVisible,
        setOutlineVisible: (visible: boolean) => setOutlineVisible(visible),
        isRulersVisible: () => rulersVisible,
        setRulersVisible: (visible: boolean) => setRulersVisible(visible),
        isFullscreen: () => isFullscreen,
        toggleFullscreen: handleToggleFullscreen,
        exportSVG: () => exportPageToSVG(flowState.activePage),
        exportPNG: () => exportPageToPNG(flowState.activePage),
      }),
      [
        flowState,
        reactFlowInstance,
        handleUndo,
        handleRedo,
        handleDelete,
        gridVisible,
        handleSelectPage,
        outlineVisible,
        rulersVisible,
        isFullscreen,
        handleToggleFullscreen,
      ],
    );

    const containerStyle = useMemo(
      () => ({ height: typeof height === "number" ? `${height}px` : height }),
      [height],
    );

    const rootClassName = [
      "wec-flow-builder",
      showPropertiesPanel && propertiesPanelCollapsed ? "wec-flow-builder--properties-collapsed" : "",
      showNodePalette && paletteCollapsed ? "wec-flow-builder--palette-collapsed" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <FlowLabelEditingContext.Provider value={labelEditingContextValue}>
      <div className={rootClassName} style={containerStyle}>
        {showNodePalette && (
          <div className="wec-flow-builder__palette">
            {paletteCollapsed ? (
              <div className="wec-flow-palette-rail">
                <button
                  type="button"
                  className="wec-flow-palette-rail__expand"
                  onClick={() => setPaletteCollapsed(false)}
                  aria-label="Expand shape palette"
                  title="Expand shapes"
                >
                  <Icon name="chevronRight" />
                </button>
              </div>
            ) : (
              <>
                <NodePalette
                  readonly={readonly}
                  onNodeDragStart={handlePaletteDragStart}
                  onNodeDragEnd={handlePaletteDragEnd}
                />
                <button
                  type="button"
                  className="wec-flow-builder__palette-collapse"
                  onClick={() => setPaletteCollapsed(true)}
                  aria-label="Collapse shape palette"
                  title="Collapse panel"
                >
                  <Icon name="chevronLeft" />
                </button>
              </>
            )}
          </div>
        )}
        <div className="wec-flow-builder__canvas-column">
        <div className="wec-flow-builder__toolbar" role="toolbar" aria-label="Canvas toolbar">
          <div className="wec-flow-builder__toolbar-group">
            <Tooltip label="Undo" placement="bottom">
              <button
                type="button"
                className="wec-flow-builder__toolbar-action"
                aria-label="Undo"
                disabled={readonly || !flowState.history.canUndo}
                onClick={handleUndo}
              >
                <Icon name="reset" />
              </button>
            </Tooltip>
            <Tooltip label="Redo" placement="bottom">
              <button
                type="button"
                className="wec-flow-builder__toolbar-action"
                aria-label="Redo"
                disabled={readonly || !flowState.history.canRedo}
                onClick={handleRedo}
              >
                <Icon name="redo" />
              </button>
            </Tooltip>
            <Tooltip label="Delete selection" placement="bottom">
              <button
                type="button"
                className="wec-flow-builder__toolbar-action"
                aria-label="Delete selection"
                disabled={
                  readonly ||
                  (flowState.selectedNodeIds.length === 0 && flowState.selectedEdgeIds.length === 0)
                }
                onClick={handleDelete}
              >
                <Icon name="trash" />
              </button>
            </Tooltip>
          </div>
          {!readonly && (
            <>
              <span className="wec-flow-builder__toolbar-divider" aria-hidden="true" />
              <div
                className="wec-flow-text-toolbar wec-flow-text-toolbar--inline"
                role="toolbar"
                aria-label="Text formatting"
              >
                <TextFormatControls
                  label={selectedNode ? selectedNode.data.label : (selectedEdge?.label ?? { runs: [{ text: "" }] })}
                  disabled={!selectedNode && !selectedEdge}
                  onChange={(next) => {
                    if (selectedNode) flowState.updateNodeData(selectedNode.id, { label: next });
                    else if (selectedEdge) flowState.updateEdgeLabel(selectedEdge.id, next);
                  }}
                />
              </div>
            </>
          )}
        </div>
        <div
          className={[
            "wec-flow-builder__canvas",
            connectingHandles ? "wec-flow-builder__canvas--connecting" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          ref={wrapperRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDoubleClick={handlePaneDoubleClick}
        >
          {dragPreview && (
            <div
              className={`wec-flow-node wec-flow-drop-preview wec-flow-node--${dragPreview.type}`}
              style={{ left: dragPreview.left, top: dragPreview.top }}
              aria-hidden="true"
            >
              <span className="wec-flow-node__label">{DEFAULT_NODE_LABELS[dragPreview.type]}</span>
            </div>
          )}
          <ReactFlow
            nodes={visibleRfNodes}
            edges={visibleRfEdges}
            nodeTypes={nodeTypes}
            onNodesChange={flowState.onNodesChange}
            onEdgesChange={flowState.onEdgesChange}
            onConnect={handleConnect}
            onConnectStart={handleConnectStart}
            onConnectEnd={handleConnectEnd}
            onNodeDrag={handleNodeDrag}
            onNodeDragStop={handleNodeDragStop}
            onPaneClick={flowState.clearSelection}
            onNodeContextMenu={handleNodeContextMenu}
            onEdgeContextMenu={handleEdgeContextMenu}
            onPaneContextMenu={handlePaneContextMenu}
            onMove={handleMove}
            nodesDraggable={!readonly}
            nodesConnectable={!readonly}
            elementsSelectable
            selectionOnDrag={!readonly}
            panOnDrag={readonly ? true : [1]}
            deleteKeyCode={null}
            colorMode="dark"
            proOptions={{ hideAttribution: true }}
          >
            {gridVisible && <Background />}
            {showControls && <Controls showInteractive={!readonly} />}
            {outlineVisible && <MiniMap pannable zoomable />}
          </ReactFlow>
          {rulersVisible && (
            <Rulers
              viewport={viewportState}
              width={wrapperRef.current?.clientWidth ?? 0}
              height={wrapperRef.current?.clientHeight ?? 0}
            />
          )}
          {alignmentGuides.map((guide) => {
            const screen = reactFlowInstance.flowToScreenPosition(
              guide.orientation === "vertical"
                ? { x: guide.position, y: 0 }
                : { x: 0, y: guide.position },
            );
            const bounds = wrapperRef.current?.getBoundingClientRect();
            const offset = guide.orientation === "vertical"
              ? screen.x - (bounds?.left ?? 0)
              : screen.y - (bounds?.top ?? 0);
            return (
              <div
                key={`${guide.orientation}-${guide.position}`}
                className={`wec-flow-alignment-guide wec-flow-alignment-guide--${guide.orientation}`}
                style={guide.orientation === "vertical" ? { left: offset } : { top: offset }}
              />
            );
          })}
          {!readonly && (
            <Tooltip label={layersPanelOpen ? "Hide layers" : "Show layers"} placement="left">
              <button
                type="button"
                className={[
                  "wec-flow-builder__layers-toggle",
                  layersPanelOpen ? "wec-flow-builder__layers-toggle--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={layersPanelOpen ? "Hide layers panel" : "Show layers panel"}
                aria-pressed={layersPanelOpen}
                onClick={() => setLayersPanelOpen((current) => !current)}
              >
                <Icon name="layers" />
              </button>
            </Tooltip>
          )}
          {layersPanelOpen && (
            <LayersPanel
              layers={flowState.activePage.layers ?? []}
              nodes={flowState.activePage.nodes}
              edges={flowState.activePage.edges}
              readonly={readonly}
              onAdd={() => flowState.addLayer()}
              onRename={flowState.renameLayer}
              onDelete={flowState.deleteLayer}
              onReorder={flowState.reorderLayers}
              onToggleVisible={flowState.toggleLayerVisibility}
              onToggleLocked={flowState.toggleLayerLocked}
              onClose={() => setLayersPanelOpen(false)}
            />
          )}
          {contextMenu && (
            <ContextMenu
              left={contextMenu.left}
              top={contextMenu.top}
              actions={contextMenuActions}
              onClose={closeContextMenu}
            />
          )}
          {editingNode && (
            <TextFormatToolbar
              label={editingNode.data.label}
              anchorPosition={editingNode.position}
              onChange={(next) => flowState.updateNodeData(editingNode.id, { label: next })}
              onClose={() => setEditingTarget(null)}
            />
          )}
        </div>
        <div className="wec-flow-builder__footer">
          <PageTabs
            pages={flowState.flow.pages}
            activePageId={flowState.activePageId}
            readonly={readonly}
            onSelect={handleSelectPage}
            onRename={flowState.renamePage}
            onAdd={flowState.addPage}
            onDuplicate={flowState.duplicatePage}
            onDelete={flowState.deletePage}
            onReorder={flowState.reorderPages}
          />
          <div className="wec-flow-builder__zoom-group">
            <Tooltip label="Zoom out" placement="top">
              <button
                type="button"
                className="wec-flow-builder__toolbar-action"
                aria-label="Zoom out"
                onClick={() => reactFlowInstance.zoomOut()}
              >
                <Icon name="zoomOut" />
              </button>
            </Tooltip>
            <span className="wec-flow-builder__toolbar-zoom" title="Current zoom">
              {Math.round(viewportState.zoom * 100)}%
            </span>
            <Tooltip label="Zoom in" placement="top">
              <button
                type="button"
                className="wec-flow-builder__toolbar-action"
                aria-label="Zoom in"
                onClick={() => reactFlowInstance.zoomIn()}
              >
                <Icon name="zoomIn" />
              </button>
            </Tooltip>
            <Tooltip label="Fit view" placement="top">
              <button
                type="button"
                className="wec-flow-builder__toolbar-action"
                aria-label="Fit view"
                onClick={() => reactFlowInstance.fitView()}
              >
                <Icon name="expand" />
              </button>
            </Tooltip>
          </div>
        </div>
        </div>
        {showPropertiesPanel && (
          <div className="wec-flow-builder__properties">
            {propertiesPanelCollapsed ? (
              <div className="wec-flow-properties-rail">
                <button
                  type="button"
                  className="wec-flow-properties-rail__expand"
                  onClick={() => setPropertiesPanelCollapsed(false)}
                  aria-label="Expand properties panel"
                  title="Expand panel"
                >
                  <Icon name="chevronLeft" />
                </button>
              </div>
            ) : (
              <PropertiesPanel
                selectedNode={selectedNode}
                selectedEdge={selectedEdge}
                selectedNodes={selectedNodes}
                selectedEdges={selectedEdges}
                nodes={flowState.activePage.nodes}
                edges={flowState.activePage.edges}
                activePage={flowState.activePage}
                onUpdateNode={flowState.updateNodeData}
                onUpdateEdge={handleUpdateEdge}
                onUpdateNodeLabel={(nodeId, label) => flowState.updateNodeData(nodeId, { label })}
                onUpdateEdgeLabel={flowState.updateEdgeLabel}
                onUpdateNodeStyleSelection={handleUpdateNodeStyleSelection}
                onUpdateEdgeStyleSelection={handleUpdateEdgeStyleSelection}
                onUpdateNodePosition={handleUpdateNodePosition}
                onUpdateNodeSize={handleUpdateNodeSize}
                onAlignSelected={flowState.alignSelected}
                onDistributeSelected={flowState.distributeSelected}
                onRotateSelected={flowState.rotateSelected}
                onFlipSelected={flowState.flipSelected}
                onDuplicateNode={handleDuplicateNode}
                onDeleteNode={handleDeleteNode}
                onDeleteEdge={handleDeleteEdge}
                onUpdatePageSettings={flowState.updatePageSettings}
                onCollapse={() => setPropertiesPanelCollapsed(true)}
                readonly={readonly}
              />
            )}
          </div>
        )}
      </div>
      </FlowLabelEditingContext.Provider>
    );
  },
);

export const FlowBuilder = forwardRef<FlowBuilderRef, FlowBuilderProps>(function FlowBuilder(
  props,
  ref,
) {
  const initialFlowForState = useMemo(
    () => props.value ?? props.initialFlow ?? createEmptyFlow(),
    // Only used for the very first render's state seed; controlled updates
    // afterwards flow through the sync effect inside FlowBuilderInner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <ReactFlowProvider>
      <FlowBuilderInner {...props} initialFlowForState={initialFlowForState} ref={ref} />
    </ReactFlowProvider>
  );
});

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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type {
  FlowBuilderProps,
  FlowBuilderRef,
  FlowDefinition,
  FlowNodeType,
} from "../../types/flow.types";
import { useFlowState } from "../../hooks/useFlowState";
import { useFlowKeyboard } from "../../hooks/useFlowKeyboard";
import { nodeTypes } from "../nodes";
import { NodePalette } from "../NodePalette/NodePalette";
import { PropertiesPanel } from "../PropertiesPanel/PropertiesPanel";
import { ContextMenu, type ContextMenuAction } from "../ContextMenu/ContextMenu";
import { generateId } from "../../utils/id";
import { exportFlow } from "../../utils/flowExport";
import { fromRFNode, fromRFEdge } from "../../utils/rfAdapters";
import "../../styles/flow-builder.css";

const NODE_DRAG_DATA_KEY = "application/wec-flow-node";

const DEFAULT_NODE_LABELS: Record<FlowNodeType, string> = {
  start: "Start",
  end: "End",
  process: "Process",
  decision: "Decision",
  input: "Input",
  output: "Output",
};

function createEmptyFlow(): FlowDefinition {
  return {
    id: generateId("flow"),
    name: "Untitled Flow",
    nodes: [],
    edges: [],
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
        updates: Partial<Pick<FlowDefinition["edges"][number], "label" | "lineStyle" | "arrow">>,
      ) => {
        if (updates.label !== undefined) {
          flowState.updateEdgeLabel(edgeId, updates.label);
        }
        if (updates.lineStyle !== undefined || updates.arrow !== undefined) {
          flowState.updateEdgeStyle(edgeId, {
            lineStyle: updates.lineStyle,
            arrow: updates.arrow,
          });
        }
      },
      [flowState],
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

    const contextMenuActions = useMemo<ContextMenuAction[]>(() => {
      if (!contextMenu) return [];
      if (contextMenu.target.kind === "node") {
        const nodeId = contextMenu.target.id;
        return [
          { key: "duplicate", label: "Duplicate node", onSelect: () => flowState.duplicateNode(nodeId) },
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

    const handleDelete = useCallback(() => {
      if (!readonly) flowState.deleteSelected();
    }, [readonly, flowState]);

    const handleUndo = useCallback(() => {
      if (!readonly) flowState.history.undo();
    }, [readonly, flowState]);

    const handleRedo = useCallback(() => {
      if (!readonly) flowState.history.redo();
    }, [readonly, flowState]);

    useFlowKeyboard({
      onDelete: handleDelete,
      onUndo: handleUndo,
      onRedo: handleRedo,
      onEscape: flowState.clearSelection,
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
      }),
      [flowState, reactFlowInstance],
    );

    const containerStyle = useMemo(
      () => ({ height: typeof height === "number" ? `${height}px` : height }),
      [height],
    );

    const rootClassName = ["wec-flow-builder", className].filter(Boolean).join(" ");

    return (
      <div className={rootClassName} style={containerStyle}>
        {showNodePalette && (
          <div className="wec-flow-builder__palette">
            <NodePalette
              readonly={readonly}
              onNodeDragStart={handlePaletteDragStart}
              onNodeDragEnd={handlePaletteDragEnd}
            />
          </div>
        )}
        <div
          className="wec-flow-builder__canvas"
          ref={wrapperRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
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
            nodes={flowState.rfNodes}
            edges={flowState.rfEdges}
            nodeTypes={nodeTypes}
            onNodesChange={flowState.onNodesChange}
            onEdgesChange={flowState.onEdgesChange}
            onConnect={handleConnect}
            onPaneClick={flowState.clearSelection}
            onNodeContextMenu={handleNodeContextMenu}
            onEdgeContextMenu={handleEdgeContextMenu}
            onPaneContextMenu={handlePaneContextMenu}
            nodesDraggable={!readonly}
            nodesConnectable={!readonly}
            elementsSelectable
            deleteKeyCode={null}
            fitView
            colorMode="dark"
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            {showControls && <Controls showInteractive={!readonly} />}
            {showMiniMap && <MiniMap pannable zoomable />}
          </ReactFlow>
          {contextMenu && (
            <ContextMenu
              left={contextMenu.left}
              top={contextMenu.top}
              actions={contextMenuActions}
              onClose={closeContextMenu}
            />
          )}
        </div>
        {showPropertiesPanel && (
          <div className="wec-flow-builder__properties">
            <PropertiesPanel
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              nodes={flowState.flow.nodes}
              edges={flowState.flow.edges}
              onUpdateNode={flowState.updateNodeData}
              onUpdateEdge={handleUpdateEdge}
              onDuplicateNode={handleDuplicateNode}
              onDeleteNode={handleDeleteNode}
              onDeleteEdge={handleDeleteEdge}
              readonly={readonly}
            />
          </div>
        )}
      </div>
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

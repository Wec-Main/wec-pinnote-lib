import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import type { DragEvent } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
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

    const handleDragOver = useCallback(
      (event: DragEvent<HTMLDivElement>) => {
        if (readonly) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      },
      [readonly],
    );

    const handleDrop = useCallback(
      (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
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
      (edgeId: string, updates: Partial<Pick<FlowDefinition["edges"][number], "label">>) => {
        if (updates.label !== undefined) {
          flowState.updateEdgeLabel(edgeId, updates.label);
        }
      },
      [flowState],
    );

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
            <NodePalette readonly={readonly} />
          </div>
        )}
        <div
          className="wec-flow-builder__canvas"
          ref={wrapperRef}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <ReactFlow
            nodes={flowState.rfNodes}
            edges={flowState.rfEdges}
            nodeTypes={nodeTypes}
            onNodesChange={flowState.onNodesChange}
            onEdgesChange={flowState.onEdgesChange}
            onConnect={handleConnect}
            onPaneClick={flowState.clearSelection}
            nodesDraggable={!readonly}
            nodesConnectable={!readonly}
            elementsSelectable
            deleteKeyCode={null}
            fitView
            colorMode="dark"
            attributionPosition="bottom-left"
          >
            <Background />
            {showControls && <Controls showInteractive={!readonly} />}
            {showMiniMap && <MiniMap pannable zoomable />}
          </ReactFlow>
        </div>
        {showPropertiesPanel && (
          <div className="wec-flow-builder__properties">
            <PropertiesPanel
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              onUpdateNode={flowState.updateNodeData}
              onUpdateEdge={handleUpdateEdge}
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

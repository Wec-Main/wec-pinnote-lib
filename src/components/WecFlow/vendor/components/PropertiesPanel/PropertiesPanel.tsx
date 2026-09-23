import * as React from "react";
import "../../styles/properties.css";
import type {
  FlowEdge,
  FlowEdgeArrow,
  FlowEdgeLineStyle,
  FlowNode,
  FlowNodeData,
} from "../../types/flow.types";

export interface PropertiesPanelProps {
  selectedNode: FlowNode | null;
  selectedEdge: FlowEdge | null;
  nodes: FlowNode[];
  edges: FlowEdge[];
  onUpdateNode: (
    nodeId: string,
    data: Partial<Pick<FlowNodeData, "label" | "description">>,
  ) => void;
  onUpdateEdge: (
    edgeId: string,
    updates: Partial<Pick<FlowEdge, "label" | "lineStyle" | "arrow">>,
  ) => void;
  onDuplicateNode: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  readonly?: boolean;
  className?: string;
}

function formatNodeTypeLabel(nodeType: FlowNode["type"]): string {
  return `${nodeType.charAt(0).toUpperCase()}${nodeType.slice(1)} Node`;
}

function nodeLabelById(nodes: FlowNode[], nodeId: string): string {
  return nodes.find((node) => node.id === nodeId)?.data.label ?? nodeId;
}

function countConnectedEdges(edges: FlowEdge[], nodeId: string): number {
  return edges.filter((edge) => edge.source === nodeId || edge.target === nodeId).length;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedNode,
  selectedEdge,
  nodes,
  edges,
  onUpdateNode,
  onUpdateEdge,
  onDuplicateNode,
  onDeleteNode,
  onDeleteEdge,
  readonly = false,
  className,
}) => {
  const rootClassName = className
    ? `wec-flow-properties ${className}`
    : "wec-flow-properties";

  const handleNodeLabelChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    if (!selectedNode) {
      return;
    }
    onUpdateNode(selectedNode.id, { label: event.target.value });
  };

  const handleNodeDescriptionChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ): void => {
    if (!selectedNode) {
      return;
    }
    onUpdateNode(selectedNode.id, { description: event.target.value });
  };

  const handleEdgeLabelChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    if (!selectedEdge) {
      return;
    }
    onUpdateEdge(selectedEdge.id, { label: event.target.value });
  };

  const handleEdgeLineStyleChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ): void => {
    if (!selectedEdge) {
      return;
    }
    onUpdateEdge(selectedEdge.id, { lineStyle: event.target.value as FlowEdgeLineStyle });
  };

  const handleEdgeArrowChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ): void => {
    if (!selectedEdge) {
      return;
    }
    onUpdateEdge(selectedEdge.id, { arrow: event.target.value as FlowEdgeArrow });
  };

  if (selectedNode) {
    const labelInputId = `wec-flow-properties__node-label-${selectedNode.id}`;
    const descriptionInputId = `wec-flow-properties__node-description-${selectedNode.id}`;
    const connectedEdgeCount = countConnectedEdges(edges, selectedNode.id);

    return (
      <div className={rootClassName}>
        <div className="wec-flow-properties__header">
          <h2 className="wec-flow-properties__title">Node Properties</h2>
          <p className="wec-flow-properties__subtitle">
            {formatNodeTypeLabel(selectedNode.type)}
          </p>
        </div>
        <dl className="wec-flow-properties__meta">
          <div className="wec-flow-properties__meta-row">
            <dt>ID</dt>
            <dd title={selectedNode.id}>{selectedNode.id}</dd>
          </div>
          <div className="wec-flow-properties__meta-row">
            <dt>Position</dt>
            <dd>
              x: {Math.round(selectedNode.position.x)}, y: {Math.round(selectedNode.position.y)}
            </dd>
          </div>
          <div className="wec-flow-properties__meta-row">
            <dt>Connections</dt>
            <dd>{connectedEdgeCount}</dd>
          </div>
        </dl>
        <form
          className="wec-flow-properties__form"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="wec-flow-properties__field">
            <label
              className="wec-flow-properties__label"
              htmlFor={labelInputId}
            >
              Label
            </label>
            <input
              id={labelInputId}
              type="text"
              className="wec-flow-properties__input"
              value={selectedNode.data.label}
              onChange={handleNodeLabelChange}
              disabled={readonly}
            />
          </div>
          <div className="wec-flow-properties__field">
            <label
              className="wec-flow-properties__label"
              htmlFor={descriptionInputId}
            >
              Description
            </label>
            <textarea
              id={descriptionInputId}
              className="wec-flow-properties__textarea"
              value={selectedNode.data.description ?? ""}
              onChange={handleNodeDescriptionChange}
              disabled={readonly}
              rows={4}
            />
          </div>
        </form>
        {!readonly && (
          <div className="wec-flow-properties__actions">
            <button
              type="button"
              className="wec-flow-properties__action"
              onClick={() => onDuplicateNode(selectedNode.id)}
            >
              Duplicate
            </button>
            <button
              type="button"
              className="wec-flow-properties__action wec-flow-properties__action--danger"
              onClick={() => onDeleteNode(selectedNode.id)}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    );
  }

  if (selectedEdge) {
    const labelInputId = `wec-flow-properties__edge-label-${selectedEdge.id}`;
    const lineStyleId = `wec-flow-properties__edge-line-style-${selectedEdge.id}`;
    const arrowId = `wec-flow-properties__edge-arrow-${selectedEdge.id}`;

    return (
      <div className={rootClassName}>
        <div className="wec-flow-properties__header">
          <h2 className="wec-flow-properties__title">
            Connection Properties
          </h2>
          <p className="wec-flow-properties__subtitle">
            {nodeLabelById(nodes, selectedEdge.source)} &rarr; {nodeLabelById(nodes, selectedEdge.target)}
          </p>
        </div>
        <dl className="wec-flow-properties__meta">
          <div className="wec-flow-properties__meta-row">
            <dt>ID</dt>
            <dd title={selectedEdge.id}>{selectedEdge.id}</dd>
          </div>
        </dl>
        <form
          className="wec-flow-properties__form"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="wec-flow-properties__field">
            <label
              className="wec-flow-properties__label"
              htmlFor={labelInputId}
            >
              Label
            </label>
            <input
              id={labelInputId}
              type="text"
              className="wec-flow-properties__input"
              value={selectedEdge.label ?? ""}
              onChange={handleEdgeLabelChange}
              disabled={readonly}
            />
          </div>
          <div className="wec-flow-properties__field">
            <label
              className="wec-flow-properties__label"
              htmlFor={lineStyleId}
            >
              Line style
            </label>
            <select
              id={lineStyleId}
              className="wec-flow-properties__input"
              value={selectedEdge.lineStyle ?? "solid"}
              onChange={handleEdgeLineStyleChange}
              disabled={readonly}
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
            </select>
          </div>
          <div className="wec-flow-properties__field">
            <label
              className="wec-flow-properties__label"
              htmlFor={arrowId}
            >
              Arrow direction
            </label>
            <select
              id={arrowId}
              className="wec-flow-properties__input"
              value={selectedEdge.arrow ?? "forward"}
              onChange={handleEdgeArrowChange}
              disabled={readonly}
            >
              <option value="none">None</option>
              <option value="forward">One-way</option>
              <option value="both">Two-way</option>
            </select>
          </div>
        </form>
        {!readonly && (
          <div className="wec-flow-properties__actions">
            <button
              type="button"
              className="wec-flow-properties__action wec-flow-properties__action--danger"
              onClick={() => onDeleteEdge(selectedEdge.id)}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={rootClassName}>
      <div className="wec-flow-properties__empty">
        Select a node or connection to edit its properties.
      </div>
    </div>
  );
};

export default PropertiesPanel;

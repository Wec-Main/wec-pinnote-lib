import * as React from "react";
import "../../styles/properties.css";
import type { FlowEdge, FlowNode, FlowNodeData } from "../../types/flow.types";

export interface PropertiesPanelProps {
  selectedNode: FlowNode | null;
  selectedEdge: FlowEdge | null;
  onUpdateNode: (
    nodeId: string,
    data: Partial<Pick<FlowNodeData, "label" | "description">>,
  ) => void;
  onUpdateEdge: (
    edgeId: string,
    updates: Partial<Pick<FlowEdge, "label">>,
  ) => void;
  readonly?: boolean;
  className?: string;
}

function formatNodeTypeLabel(nodeType: FlowNode["type"]): string {
  return `${nodeType.charAt(0).toUpperCase()}${nodeType.slice(1)} Node`;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedNode,
  selectedEdge,
  onUpdateNode,
  onUpdateEdge,
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

  if (selectedNode) {
    const labelInputId = `wec-flow-properties__node-label-${selectedNode.id}`;
    const descriptionInputId = `wec-flow-properties__node-description-${selectedNode.id}`;

    return (
      <div className={rootClassName}>
        <div className="wec-flow-properties__header">
          <h2 className="wec-flow-properties__title">Node Properties</h2>
          <p className="wec-flow-properties__subtitle">
            {formatNodeTypeLabel(selectedNode.type)}
          </p>
        </div>
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
      </div>
    );
  }

  if (selectedEdge) {
    const labelInputId = `wec-flow-properties__edge-label-${selectedEdge.id}`;

    return (
      <div className={rootClassName}>
        <div className="wec-flow-properties__header">
          <h2 className="wec-flow-properties__title">
            Connection Properties
          </h2>
          <p className="wec-flow-properties__subtitle">
            {selectedEdge.source} &rarr; {selectedEdge.target}
          </p>
        </div>
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
        </form>
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

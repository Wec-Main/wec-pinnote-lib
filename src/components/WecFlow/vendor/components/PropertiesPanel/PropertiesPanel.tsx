import * as React from "react";
import { useState } from "react";
import { ColorPicker, Icon, Tabs, type TabDefinition } from "../../../../primitives";
import "../../styles/properties.css";
import type {
  FlowAlignEdge,
  FlowAxis,
  FlowEdge,
  FlowNode,
  FlowNodeData,
  FlowNodeStyle,
  FlowPage,
  FlowPageGridSettings,
  RichText,
} from "../../types/flow.types";
import { plainTextToRichText, richTextToPlainText } from "../../utils/richText";
import { StyleTab } from "./StyleTab";
import { ArrangeTab } from "./ArrangeTab";
import { TextTab } from "./TextTab";

export interface PropertiesPanelProps {
  selectedNode: FlowNode | null;
  selectedEdge: FlowEdge | null;
  selectedNodes: FlowNode[];
  selectedEdges: FlowEdge[];
  nodes: FlowNode[];
  edges: FlowEdge[];
  activePage: FlowPage;
  onUpdatePageSettings: (
    pageId: string,
    updates: Partial<Pick<FlowPage, "background">> & { gridSettings?: Partial<FlowPageGridSettings> },
  ) => void;
  onUpdateNode: (
    nodeId: string,
    data: Partial<Pick<FlowNodeData, "label" | "description">>,
  ) => void;
  onUpdateEdge: (
    edgeId: string,
    updates: Partial<Pick<FlowEdge, "label" | "lineStyle" | "arrow" | "arrowStart" | "arrowEnd">>,
  ) => void;
  onUpdateNodeLabel: (nodeId: string, label: RichText) => void;
  onUpdateEdgeLabel: (edgeId: string, label: RichText) => void;
  onUpdateNodeStyleSelection: (updates: Partial<FlowNodeStyle>) => void;
  onUpdateEdgeStyleSelection: (
    updates: Partial<
      Pick<
        FlowEdge,
        | "lineStyle"
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
  onUpdateNodePosition: (nodeId: string, x: number, y: number) => void;
  onUpdateNodeSize: (nodeId: string, width: number, height: number) => void;
  onAlignSelected: (edge: FlowAlignEdge) => void;
  onDistributeSelected: (axis: FlowAxis) => void;
  onRotateSelected: (degrees: number) => void;
  onFlipSelected: (axis: FlowAxis) => void;
  onDuplicateNode: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onCollapse?: () => void;
  readonly?: boolean;
  className?: string;
}

function formatNodeTypeLabel(nodeType: FlowNode["type"]): string {
  return `${nodeType.charAt(0).toUpperCase()}${nodeType.slice(1)} Node`;
}

function nodeLabelById(nodes: FlowNode[], nodeId: string): string {
  const label = nodes.find((node) => node.id === nodeId)?.data.label;
  return label ? richTextToPlainText(label) : nodeId;
}

const TAB_DEFINITIONS: TabDefinition[] = [
  { id: "style", label: "Style" },
  { id: "text", label: "Text" },
  { id: "arrange", label: "Arrange" },
];

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedNode,
  selectedEdge,
  selectedNodes,
  selectedEdges,
  nodes,
  activePage,
  onUpdatePageSettings,
  onUpdateNode,
  onUpdateEdge,
  onUpdateNodeLabel,
  onUpdateEdgeLabel,
  onUpdateNodeStyleSelection,
  onUpdateEdgeStyleSelection,
  onUpdateNodePosition,
  onUpdateNodeSize,
  onAlignSelected,
  onDistributeSelected,
  onRotateSelected,
  onFlipSelected,
  onDuplicateNode,
  onDeleteNode,
  onDeleteEdge,
  onCollapse,
  readonly = false,
  className,
}) => {
  const [activeTabId, setActiveTabId] = useState<string>("style");

  const rootClassName = className
    ? `wec-flow-properties ${className}`
    : "wec-flow-properties";

  const collapseButton = onCollapse ? (
    <button
      type="button"
      className="wec-flow-properties__collapse"
      onClick={onCollapse}
      aria-label="Collapse properties panel"
      title="Collapse panel"
    >
      <Icon name="close" />
    </button>
  ) : null;

  const handleNodeLabelChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    if (!selectedNode) {
      return;
    }
    onUpdateNode(selectedNode.id, { label: plainTextToRichText(event.target.value) });
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
    onUpdateEdge(selectedEdge.id, { label: plainTextToRichText(event.target.value) });
  };

  if (selectedNodes.length > 0 || selectedEdges.length > 0) {
    const multi = selectedNodes.length + selectedEdges.length > 1;
    const labelInputId = selectedNode ? `wec-flow-properties__node-label-${selectedNode.id}` : "";
    const descriptionInputId = selectedNode
      ? `wec-flow-properties__node-description-${selectedNode.id}`
      : "";
    const edgeLabelInputId = selectedEdge
      ? `wec-flow-properties__edge-label-${selectedEdge.id}`
      : "";

    return (
      <div className={rootClassName}>
        <div className="wec-flow-properties__header">
          <div className="wec-flow-properties__header-text">
            <h2 className="wec-flow-properties__title">
              {multi
                ? `${selectedNodes.length + selectedEdges.length} Selected`
                : selectedNode
                  ? "Node Properties"
                  : "Connection Properties"}
            </h2>
            {!multi && selectedNode && (
              <p className="wec-flow-properties__subtitle">{formatNodeTypeLabel(selectedNode.type)}</p>
            )}
            {!multi && selectedEdge && (
              <p className="wec-flow-properties__subtitle">
                {nodeLabelById(nodes, selectedEdge.source)} &rarr; {nodeLabelById(nodes, selectedEdge.target)}
              </p>
            )}
          </div>
          {collapseButton}
        </div>

        {!multi && selectedNode && (
          <>
            <form
              className="wec-flow-properties__form"
              onSubmit={(event) => event.preventDefault()}
            >
              <div className="wec-flow-properties__field">
                <label className="wec-flow-properties__label" htmlFor={labelInputId}>
                  Label
                </label>
                <input
                  id={labelInputId}
                  type="text"
                  className="wec-flow-properties__input"
                  value={richTextToPlainText(selectedNode.data.label)}
                  onChange={handleNodeLabelChange}
                  disabled={readonly}
                />
              </div>
              <div className="wec-flow-properties__field">
                <label className="wec-flow-properties__label" htmlFor={descriptionInputId}>
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
          </>
        )}

        {!multi && selectedEdge && (
          <>
            <form
              className="wec-flow-properties__form"
              onSubmit={(event) => event.preventDefault()}
            >
              <div className="wec-flow-properties__field">
                <label className="wec-flow-properties__label" htmlFor={edgeLabelInputId}>
                  Label
                </label>
                <input
                  id={edgeLabelInputId}
                  type="text"
                  className="wec-flow-properties__input"
                  value={selectedEdge.label ? richTextToPlainText(selectedEdge.label) : ""}
                  onChange={handleEdgeLabelChange}
                  disabled={readonly}
                />
              </div>
            </form>
          </>
        )}

        <Tabs tabs={TAB_DEFINITIONS} activeTabId={activeTabId} onChange={setActiveTabId} ariaLabel="Properties" />

        <div className="wec-flow-properties__tab-panel">
          {activeTabId === "style" && (
            <StyleTab
              selectedNodes={selectedNodes}
              selectedEdges={selectedEdges}
              onUpdateNodeStyle={onUpdateNodeStyleSelection}
              onUpdateEdgeStyle={(updates) =>
                onUpdateEdgeStyleSelection({
                  lineStyle: updates.lineStyle,
                  arrowStart: updates.arrowStart,
                  arrowEnd: updates.arrowEnd,
                  arrowStartShape: updates.arrowStartShape,
                  arrowEndShape: updates.arrowEndShape,
                  stroke: updates.stroke,
                  strokeWidth: updates.strokeWidth,
                  routing: updates.routing,
                })
              }
              readonly={readonly}
            />
          )}
          {activeTabId === "text" && (
            <TextTab
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              onUpdateNodeLabel={onUpdateNodeLabel}
              onUpdateEdgeLabel={onUpdateEdgeLabel}
              readonly={readonly}
            />
          )}
          {activeTabId === "arrange" && (
            <ArrangeTab
              selectedNodes={selectedNodes}
              onUpdatePosition={onUpdateNodePosition}
              onUpdateSize={onUpdateNodeSize}
              onAlign={onAlignSelected}
              onDistribute={onDistributeSelected}
              onRotate={onRotateSelected}
              onFlip={onFlipSelected}
              readonly={readonly}
            />
          )}
        </div>

        {!readonly && !multi && (
          <div className="wec-flow-properties__actions">
            {selectedNode && (
              <>
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
              </>
            )}
            {selectedEdge && (
              <button
                type="button"
                className="wec-flow-properties__action wec-flow-properties__action--danger"
                onClick={() => onDeleteEdge(selectedEdge.id)}
              >
                Delete
              </button>
            )}
          </div>
        )}

        {!multi && (selectedNode || selectedEdge) && (
          <dl className="wec-flow-properties__meta">
            {selectedNode && (
              <>
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
                {selectedNode.width !== undefined && selectedNode.height !== undefined && (
                  <div className="wec-flow-properties__meta-row">
                    <dt>Size</dt>
                    <dd>
                      {Math.round(selectedNode.width)} &times; {Math.round(selectedNode.height)}
                    </dd>
                  </div>
                )}
              </>
            )}
            {selectedEdge && (
              <div className="wec-flow-properties__meta-row">
                <dt>ID</dt>
                <dd title={selectedEdge.id}>{selectedEdge.id}</dd>
              </div>
            )}
          </dl>
        )}
      </div>
    );
  }

  const gridSettings = activePage.gridSettings ?? {};

  return (
    <div className={rootClassName}>
      <div className="wec-flow-properties__header">
        <div className="wec-flow-properties__header-text">
          <h2 className="wec-flow-properties__title">Page Properties</h2>
          <p className="wec-flow-properties__subtitle">{activePage.name}</p>
        </div>
        {collapseButton}
      </div>
      <form className="wec-flow-properties__form" onSubmit={(event) => event.preventDefault()}>
        <div className="wec-flow-properties__field">
          <label className="wec-flow-properties__label" htmlFor="wec-flow-properties__page-background">
            Background
          </label>
          <ColorPicker
            value={activePage.background ?? null}
            onChange={(value) =>
              onUpdatePageSettings(activePage.id, { background: value ?? undefined })
            }
            allowNone
            noneLabel="Default"
            ariaLabel="Page background color"
            showValue
          />
        </div>
        <div className="wec-flow-properties__field">
          <label className="wec-flow-properties__label">
            <input
              type="checkbox"
              checked={gridSettings.enabled ?? true}
              disabled={readonly}
              onChange={(event) =>
                onUpdatePageSettings(activePage.id, {
                  gridSettings: { enabled: event.target.checked },
                })
              }
            />
            Show grid
          </label>
        </div>
        <div className="wec-flow-properties__field">
          <label className="wec-flow-properties__label" htmlFor="wec-flow-properties__page-grid-size">
            Grid size (px)
          </label>
          <input
            id="wec-flow-properties__page-grid-size"
            type="number"
            min={4}
            max={200}
            step={1}
            className="wec-flow-properties__input"
            value={gridSettings.size ?? 16}
            disabled={readonly}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              onUpdatePageSettings(activePage.id, {
                gridSettings: {
                  size: Number.isNaN(parsed) ? 4 : Math.min(200, Math.max(4, parsed)),
                },
              });
            }}
          />
        </div>
        <div className="wec-flow-properties__field">
          <label className="wec-flow-properties__label">
            <input
              type="checkbox"
              checked={gridSettings.snap ?? false}
              disabled={readonly}
              onChange={(event) =>
                onUpdatePageSettings(activePage.id, {
                  gridSettings: { snap: event.target.checked },
                })
              }
            />
            Snap to grid
          </label>
        </div>
      </form>
    </div>
  );
};

export default PropertiesPanel;

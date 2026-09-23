import { useState, type KeyboardEvent } from "react";
import { Icon } from "../../../../primitives";
import type { FlowLayer, FlowNode, FlowEdge } from "../../types/flow.types";
import "./layers-panel.css";

const DEFAULT_LAYER_ID = "__default__";

export interface LayersPanelProps {
  layers: FlowLayer[];
  nodes: FlowNode[];
  edges: FlowEdge[];
  readonly?: boolean;
  onAdd: () => void;
  onRename: (layerId: string, name: string) => void;
  onDelete: (layerId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onToggleVisible: (layerId: string, visible: boolean) => void;
  onToggleLocked: (layerId: string, locked: boolean) => void;
  onClose: () => void;
}

export function LayersPanel({
  layers,
  nodes,
  edges,
  readonly = false,
  onAdd,
  onRename,
  onDelete,
  onReorder,
  onToggleVisible,
  onToggleLocked,
  onClose,
}: LayersPanelProps) {
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  const startRename = (layer: FlowLayer) => {
    if (readonly) return;
    setEditingLayerId(layer.id);
    setEditingName(layer.name);
  };

  const commitRename = () => {
    if (editingLayerId && editingName.trim().length > 0) {
      onRename(editingLayerId, editingName.trim());
    }
    setEditingLayerId(null);
  };

  const handleRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitRename();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setEditingLayerId(null);
    }
  };

  const elementCountForLayer = (layerId: string | null): number => {
    if (layerId === DEFAULT_LAYER_ID || layerId === null) {
      return (
        nodes.filter((node) => node.layerId === undefined).length +
        edges.filter((edge) => edge.layerId === undefined).length
      );
    }
    return (
      nodes.filter((node) => node.layerId === layerId).length +
      edges.filter((edge) => edge.layerId === layerId).length
    );
  };

  return (
    <div className="wec-flow-layers-panel" role="region" aria-label="Layers">
      <div className="wec-flow-layers-panel__header">
        <span className="wec-flow-layers-panel__title">Layers</span>
        <div className="wec-flow-layers-panel__header-actions">
          {!readonly && (
            <button type="button" aria-label="Add layer" title="Add layer" onClick={onAdd}>
              <Icon name="plus" />
            </button>
          )}
          <button type="button" aria-label="Close layers panel" title="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
      </div>
      <ul className="wec-flow-layers-panel__list">
        <li
          className={[
            "wec-flow-layers-panel__row",
            selectedLayerId === DEFAULT_LAYER_ID ? "wec-flow-layers-panel__row--selected" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setSelectedLayerId(DEFAULT_LAYER_ID)}
        >
          <span className="wec-flow-layers-panel__name">Default Layer</span>
          <span className="wec-flow-layers-panel__count">{elementCountForLayer(DEFAULT_LAYER_ID)}</span>
        </li>
        {layers.map((layer, index) => (
          <li
            key={layer.id}
            className={[
              "wec-flow-layers-panel__row",
              selectedLayerId === layer.id ? "wec-flow-layers-panel__row--selected" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setSelectedLayerId(layer.id)}
            onDoubleClick={() => startRename(layer)}
          >
            {editingLayerId === layer.id ? (
              <input
                autoFocus
                className="wec-flow-layers-panel__rename-input"
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
                onBlur={commitRename}
                onKeyDown={handleRenameKeyDown}
                onClick={(event) => event.stopPropagation()}
              />
            ) : (
              <span className="wec-flow-layers-panel__name">{layer.name}</span>
            )}
            <span className="wec-flow-layers-panel__count">{elementCountForLayer(layer.id)}</span>
            {!readonly && (
              <div className="wec-flow-layers-panel__actions">
                <button
                  type="button"
                  aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                  title={layer.visible ? "Hide layer" : "Show layer"}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleVisible(layer.id, !layer.visible);
                  }}
                >
                  <Icon name={layer.visible ? "eye" : "eyeOff"} />
                </button>
                <button
                  type="button"
                  className={layer.locked ? "wec-flow-layers-panel__action--active" : undefined}
                  aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
                  title={layer.locked ? "Unlock layer" : "Lock layer"}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleLocked(layer.id, !layer.locked);
                  }}
                >
                  <Icon name={layer.locked ? "lock" : "lockOpen"} />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${layer.name} up`}
                  title="Move up"
                  disabled={index === 0}
                  onClick={(event) => {
                    event.stopPropagation();
                    onReorder(index, index - 1);
                  }}
                >
                  <Icon name="chevronUp" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${layer.name} down`}
                  title="Move down"
                  disabled={index === layers.length - 1}
                  onClick={(event) => {
                    event.stopPropagation();
                    onReorder(index, index + 1);
                  }}
                >
                  <Icon name="chevronDown" />
                </button>
                <button
                  type="button"
                  className="wec-flow-layers-panel__action--danger"
                  aria-label={`Delete ${layer.name}`}
                  title="Delete layer"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(layer.id);
                  }}
                >
                  <Icon name="trash" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

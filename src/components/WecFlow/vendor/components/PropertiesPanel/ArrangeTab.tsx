import type { FC } from "react";
import type { FlowAlignEdge, FlowAxis, FlowNode } from "../../types/flow.types";

export interface ArrangeTabProps {
  selectedNodes: FlowNode[];
  onUpdatePosition: (nodeId: string, x: number, y: number) => void;
  onUpdateSize: (nodeId: string, width: number, height: number) => void;
  onAlign: (edge: FlowAlignEdge) => void;
  onDistribute: (axis: FlowAxis) => void;
  onRotate: (degrees: number) => void;
  onFlip: (axis: FlowAxis) => void;
  readonly?: boolean;
}

const ALIGN_OPTIONS: { edge: FlowAlignEdge; label: string }[] = [
  { edge: "left", label: "Left" },
  { edge: "center", label: "Center" },
  { edge: "right", label: "Right" },
  { edge: "top", label: "Top" },
  { edge: "middle", label: "Middle" },
  { edge: "bottom", label: "Bottom" },
];

export const ArrangeTab: FC<ArrangeTabProps> = ({
  selectedNodes,
  onUpdatePosition,
  onUpdateSize,
  onAlign,
  onDistribute,
  onRotate,
  onFlip,
  readonly = false,
}) => {
  if (selectedNodes.length === 0) {
    return (
      <div className="wec-flow-properties__empty">
        Select one or more nodes to arrange them.
      </div>
    );
  }

  const singleNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const canAlign = selectedNodes.length >= 2;
  const canDistribute = selectedNodes.length >= 3;

  return (
    <div className="wec-flow-properties__form">
      {singleNode && (
        <>
          <div className="wec-flow-properties__field">
            <label className="wec-flow-properties__label">X</label>
            <input
              type="number"
              className="wec-flow-properties__input"
              value={Math.round(singleNode.position.x)}
              disabled={readonly}
              onChange={(event) =>
                onUpdatePosition(singleNode.id, Number(event.target.value) || 0, singleNode.position.y)
              }
            />
          </div>
          <div className="wec-flow-properties__field">
            <label className="wec-flow-properties__label">Y</label>
            <input
              type="number"
              className="wec-flow-properties__input"
              value={Math.round(singleNode.position.y)}
              disabled={readonly}
              onChange={(event) =>
                onUpdatePosition(singleNode.id, singleNode.position.x, Number(event.target.value) || 0)
              }
            />
          </div>
          <div className="wec-flow-properties__field">
            <label className="wec-flow-properties__label">Width</label>
            <input
              type="number"
              className="wec-flow-properties__input"
              min={1}
              value={singleNode.width !== undefined ? Math.round(singleNode.width) : ""}
              placeholder={singleNode.width === undefined ? "Auto" : undefined}
              disabled={readonly}
              onChange={(event) => {
                const width = Number(event.target.value);
                if (width > 0) {
                  onUpdateSize(singleNode.id, width, singleNode.height ?? width);
                }
              }}
            />
          </div>
          <div className="wec-flow-properties__field">
            <label className="wec-flow-properties__label">Height</label>
            <input
              type="number"
              className="wec-flow-properties__input"
              min={1}
              value={singleNode.height !== undefined ? Math.round(singleNode.height) : ""}
              placeholder={singleNode.height === undefined ? "Auto" : undefined}
              disabled={readonly}
              onChange={(event) => {
                const height = Number(event.target.value);
                if (height > 0) {
                  onUpdateSize(singleNode.id, singleNode.width ?? height, height);
                }
              }}
            />
          </div>
        </>
      )}

      <div className="wec-flow-properties__field">
        <label className="wec-flow-properties__label">Align</label>
        <div className="wec-flow-properties__button-row">
          {ALIGN_OPTIONS.map((option) => (
            <button
              key={option.edge}
              type="button"
              className="wec-flow-properties__action"
              disabled={readonly || !canAlign}
              onClick={() => onAlign(option.edge)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="wec-flow-properties__field">
        <label className="wec-flow-properties__label">Distribute</label>
        <div className="wec-flow-properties__button-row">
          <button
            type="button"
            className="wec-flow-properties__action"
            disabled={readonly || !canDistribute}
            onClick={() => onDistribute("horizontal")}
          >
            Horizontally
          </button>
          <button
            type="button"
            className="wec-flow-properties__action"
            disabled={readonly || !canDistribute}
            onClick={() => onDistribute("vertical")}
          >
            Vertically
          </button>
        </div>
      </div>

      <div className="wec-flow-properties__field">
        <label className="wec-flow-properties__label">Rotate</label>
        <div className="wec-flow-properties__button-row">
          <button
            type="button"
            className="wec-flow-properties__action"
            disabled={readonly}
            onClick={() => onRotate(90)}
          >
            Rotate 90°
          </button>
          <button
            type="button"
            className="wec-flow-properties__action"
            disabled={readonly}
            onClick={() => onRotate(-90)}
          >
            Rotate -90°
          </button>
        </div>
      </div>

      <div className="wec-flow-properties__field">
        <label className="wec-flow-properties__label">Flip</label>
        <div className="wec-flow-properties__button-row">
          <button
            type="button"
            className="wec-flow-properties__action"
            disabled={readonly}
            onClick={() => onFlip("horizontal")}
          >
            Flip Horizontal
          </button>
          <button
            type="button"
            className="wec-flow-properties__action"
            disabled={readonly}
            onClick={() => onFlip("vertical")}
          >
            Flip Vertical
          </button>
        </div>
      </div>
    </div>
  );
};

export default ArrangeTab;

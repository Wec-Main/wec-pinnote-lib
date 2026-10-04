import { memo, useEffect, type CSSProperties } from "react";
import { useFlowEngine, useFlowState } from "../FlowContext";
import { useNodeDrag } from "../../../hooks/useNodeDrag";
import {
  VIEWPORT_CULL_MARGIN_PX,
  VIEWPORT_CULL_NODE_THRESHOLD,
} from "../../../utils/flowchart/constants";
import {
  getNodeSize,
  getRenderedHandles,
  getVisibleRect,
  rectsIntersect,
} from "../../../utils/flowchart/geometry";
import { isLaneShape } from "../../../utils/flowchart/nodeTypes";
import { cx, shallowEqual } from "../../../utils/flowchart/shallow";
import { DefaultNodeContent } from "./DefaultNodeContent";
import { Handle } from "./Handle";
import { useNodeEditTarget, watchNodeCreationForInlineEdit } from "./nodeEditTrigger";
import { NodeShape } from "./NodeShape";
import { HoverArrows } from "./HoverArrows";
import { QuickAdd } from "./QuickAdd";
import { ResizeHandles } from "./ResizeHandles";
import { aiMarkClass, useAiPreviewMark } from "../../ai/components/AiPreviewScope";
import type { LineDashStyle } from "../../../types/flowchart.types";

function borderDasharray(style: LineDashStyle): string {
  return style === "dotted" ? "2 3" : "6 4";
}

export const NodeItem = memo(function NodeItem({ id }: { id: string }) {
  const engine = useFlowEngine();
  const node = useFlowState((s) => s.nodeLookup.get(id));
  const selected = useFlowState((s) => s.selectedNodeIds.has(id));
  const issue = useFlowState((s) => s.issueNodeIds.get(id));
  const readOnly = useFlowState((s) => s.readOnly);
  useFlowState((s) => s.registryVersion);
  const onPointerDown = useNodeDrag(id);
  const [editTargetId, setEditTarget] = useNodeEditTarget();
  const editing = editTargetId === id;
  const aiMark = useAiPreviewMark("flow", id);

  if (!node) return null;
  const def = engine.getDefinition(node.type);
  const { width, height } = getNodeSize(node, def);
  const Content = def.component ?? DefaultNodeContent;
  const { data } = node;

  return (
    <div
      className={cx(
        "wpn-flowchart-node__node",
        `wpn-flowchart-node__shape-${def.shape}`,
        selected && "wpn-flowchart-node__selected",
        issue && `wpn-flowchart-node__issue-${issue}`,
        readOnly && "wpn-flowchart-node__read-only",
        aiMarkClass(aiMark),
      )}
      style={
        {
          transform: `translate(${node.position.x}px, ${node.position.y}px)`,
          width,
          height,
          "--node-color": def.color,
          ...(data.fillColor ? { "--node-fill-color": data.fillColor } : {}),
          ...(data.borderColor ? { "--node-border-color": data.borderColor } : {}),
          ...(data.borderWidth != null ? { "--node-border-width": `${data.borderWidth}px` } : {}),
          ...(data.borderStyle && data.borderStyle !== "solid"
            ? { "--node-border-dasharray": borderDasharray(data.borderStyle) }
            : {}),
          ...(data.fontColor ? { "--node-font-color": data.fontColor } : {}),
          ...(data.opacity != null ? { opacity: data.opacity } : {}),
        } as CSSProperties
      }
      data-node-id={id}
      data-node-type={node.type}
      onPointerDown={onPointerDown}
      onDoubleClick={() => !readOnly && setEditTarget(id)}
    >
      <NodeShape shape={def.shape} width={width} height={height} radius={data.borderRadius} />
      <div className="wpn-flowchart-node__content">
        <Content
          node={node}
          definition={def}
          selected={selected}
          width={width}
          height={height}
          editing={!readOnly && editing}
          onEditDone={() => setEditTarget(null)}
        />
      </div>
      {!readOnly &&
        getRenderedHandles(def).map((h) => (
          <Handle
            key={h.id}
            nodeId={id}
            handle={h}
            definition={def}
            width={width}
            height={height}
          />
        ))}
      {selected && !readOnly && def.resizable !== false && (
        <ResizeHandles nodeId={id} definition={def} />
      )}
      {!readOnly && <HoverArrows nodeId={id} definition={def} width={width} height={height} />}
      {!readOnly && !editing && (
        <QuickAdd nodeId={id} definition={def} width={width} height={height} />
      )}
    </div>
  );
});

export const NodeRenderer = memo(function NodeRenderer({ lanes = false }: { lanes?: boolean }) {
  const engine = useFlowEngine();
  useFlowState((s) => s.registryVersion);
  const ids = useFlowState((s) => {
    const laneNodes = s.nodes.filter(
      (n) => isLaneShape(engine.getDefinition(n.type).shape) === lanes,
    );
    if (s.nodes.length <= VIEWPORT_CULL_NODE_THRESHOLD) return laneNodes.map((n) => n.id);
    // Large documents only: mount just the nodes whose rect intersects the
    // visible viewport (plus a generous margin), so cost scales with what's
    // on screen rather than the whole document. Selected nodes are always
    // kept mounted so an in-progress resize/edit/selection never disappears
    // out from under the user.
    const visible = getVisibleRect(s.viewport, s.canvasSize, VIEWPORT_CULL_MARGIN_PX);
    return laneNodes
      .filter((n) => s.selectedNodeIds.has(n.id) || rectsIntersect(visible, engine.getNodeRect(n)))
      .map((n) => n.id);
  }, shallowEqual);
  useEffect(() => {
    if (lanes) return;
    return watchNodeCreationForInlineEdit(engine);
  }, [engine, lanes]);
  return (
    <div className={cx("wpn-flowchart-node__layer", lanes && "wpn-flowchart-node__layer-lanes")}>
      {ids.map((id) => (
        <NodeItem key={id} id={id} />
      ))}
    </div>
  );
});

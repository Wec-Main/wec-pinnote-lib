import type {
  FlowEdge,
  FlowJSON,
  FlowNode,
  HandleSide,
  LineDashStyle,
  Rect,
  XYPosition,
} from "../../../types/flowchart.types";
import { getEdgePath } from "../edgePaths";
import { findHandle, getHandlePosition, getNodeSize } from "../geometry";
import { isLaneShape, type NodeTypeDefinition } from "../nodeTypes";

const DIAGRAM_PADDING = 60;
const DEFAULT_FILL = "#18181b";
const DEFAULT_FONT_COLOR = "#f4f4f5";
const DEFAULT_LINE_COLOR = "#94a3b8";
const DEFAULT_LABEL_COLOR = "#475569";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dashArray(style: LineDashStyle | undefined): string {
  if (style === "dashed") return ' stroke-dasharray="6 4"';
  if (style === "dotted") return ' stroke-dasharray="2 3"';
  return "";
}

function nodeRect(node: FlowNode, def: NodeTypeDefinition): Rect {
  const { width, height } = getNodeSize(node, def);
  return { x: node.position.x, y: node.position.y, width, height };
}

function nodeShapeMarkup(node: FlowNode, def: NodeTypeDefinition, rect: Rect): string {
  const fill = node.data.fillColor ?? DEFAULT_FILL;
  const stroke = node.data.borderColor ?? def.color;
  const strokeWidth = node.data.borderWidth ?? 1.5;
  const dash = dashArray(node.data.borderStyle);
  const opacity = node.data.opacity != null ? ` opacity="${node.data.opacity}"` : "";
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  if (def.shape === "diamond") {
    const points = `${cx},${rect.y} ${rect.x + rect.width},${cy} ${cx},${rect.y + rect.height} ${rect.x},${cy}`;
    return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${dash}${opacity} />`;
  }
  if (def.shape === "circle" || def.shape === "ellipse") {
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rect.width / 2}" ry="${rect.height / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${dash}${opacity} />`;
  }
  const rx =
    node.data.borderRadius ??
    (def.shape === "pill"
      ? rect.height / 2
      : def.shape === "rounded"
        ? 12
        : def.shape === "square"
          ? 0
          : 6);
  return `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${dash}${opacity} />`;
}

function nodeGroup(node: FlowNode, def: NodeTypeDefinition): string {
  const rect = nodeRect(node, def);
  const fontColor = node.data.fontColor ?? DEFAULT_FONT_COLOR;
  const textX = rect.x + rect.width / 2;
  const textY = rect.y + rect.height / 2 + 4;
  const label = `<text x="${textX}" y="${textY}" text-anchor="middle" fill="${fontColor}" font-weight="600">${escapeXml(node.data.label)}</text>`;
  return `<g>\n${nodeShapeMarkup(node, def, rect)}\n${label}\n</g>`;
}

function rectCenter(rect: Rect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function anchorTowardRect(
  rect: Rect,
  target: XYPosition,
): { position: XYPosition; side: HandleSide } {
  const center = rectCenter(rect);
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  const side: HandleSide =
    Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "right" : "left") : dy >= 0 ? "bottom" : "top";
  if (dx === 0 && dy === 0) return { position: center, side };
  const halfW = rect.width / 2;
  const halfH = rect.height / 2;
  const scale = Math.min(
    halfW / Math.max(Math.abs(dx), 1e-6),
    halfH / Math.max(Math.abs(dy), 1e-6),
  );
  return { position: { x: center.x + dx * scale, y: center.y + dy * scale }, side };
}

function endpoint(
  node: FlowNode,
  def: NodeTypeDefinition,
  kind: "source" | "target",
  handleId: string | undefined,
  towards: XYPosition,
): { position: XYPosition; side: HandleSide } {
  const handle = findHandle(def, kind, handleId);
  if (handle) return { position: getHandlePosition(node, def, handle), side: handle.side };
  return anchorTowardRect(nodeRect(node, def), towards);
}

function edgeGroup(
  edge: FlowEdge,
  nodeLookup: ReadonlyMap<string, FlowNode>,
  getDefinition: GetDefinition,
): string {
  const source = nodeLookup.get(edge.source);
  const target = nodeLookup.get(edge.target);
  if (!source || !target) return "";
  const sourceDef = getDefinition(source.type);
  const targetDef = getDefinition(target.type);
  const start = endpoint(
    source,
    sourceDef,
    "source",
    edge.sourceHandle,
    rectCenter(nodeRect(target, targetDef)),
  );
  const end = endpoint(
    target,
    targetDef,
    "target",
    edge.targetHandle,
    rectCenter(nodeRect(source, sourceDef)),
  );
  const { path, labelX, labelY } = getEdgePath(edge.type ?? "step", {
    source: start.position,
    sourceSide: start.side,
    target: end.position,
    targetSide: end.side,
    bend: edge.bend,
  });
  const stroke = edge.lineColor ?? DEFAULT_LINE_COLOR;
  const strokeWidth = edge.lineWidth ?? 1.75;
  const dash = dashArray(edge.dashStyle);
  const opacity = edge.opacity != null ? ` opacity="${edge.opacity}"` : "";
  const arrowStyle = edge.arrowStyle ?? "arrow";
  const markerEnd = arrowStyle === "none" ? "" : ` marker-end="url(#flow-arrow)"`;
  const markerStart = arrowStyle === "double" ? ` marker-start="url(#flow-arrow-start)"` : "";
  const line = `<path d="${path}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"${dash}${opacity}${markerStart}${markerEnd} />`;
  const handleLabel = findHandle(sourceDef, "source", edge.sourceHandle)?.label;
  const labelText = edge.label ?? handleLabel;
  const label = labelText
    ? `<text x="${labelX}" y="${labelY - 6}" text-anchor="middle" fill="${DEFAULT_LABEL_COLOR}" font-size="11">${escapeXml(labelText)}</text>`
    : "";
  return [line, label].filter(Boolean).join("\n");
}

type GetDefinition = (type: string) => NodeTypeDefinition;

export function generateFlowDiagramSvg(flow: FlowJSON, getDefinition: GetDefinition): string {
  const nodes = flow.nodes.filter((node) => !isLaneShape(getDefinition(node.type).shape));
  if (nodes.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" width="400" height="200" font-family="sans-serif" font-size="12"></svg>`;
  }
  const rects = nodes.map((node) => nodeRect(node, getDefinition(node.type)));
  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));
  const viewX = minX - DIAGRAM_PADDING;
  const viewY = minY - DIAGRAM_PADDING;
  const viewWidth = maxX - minX + DIAGRAM_PADDING * 2;
  const viewHeight = maxY - minY + DIAGRAM_PADDING * 2;

  const nodeLookup = new Map(flow.nodes.map((node) => [node.id, node]));
  const edgeMarkup = flow.edges
    .map((edge) => edgeGroup(edge, nodeLookup, getDefinition))
    .filter(Boolean)
    .join("\n");
  const nodeMarkup = nodes.map((node) => nodeGroup(node, getDefinition(node.type))).join("\n");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewX} ${viewY} ${viewWidth} ${viewHeight}" width="${viewWidth}" height="${viewHeight}" font-family="sans-serif" font-size="12">`,
    `<defs>`,
    `<marker id="flow-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0.5 L 9 5 L 0 9.5 z" fill="context-stroke" /></marker>`,
    `<marker id="flow-arrow-start" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0.5 L 9 5 L 0 9.5 z" fill="context-stroke" /></marker>`,
    `</defs>`,
    `<rect x="${viewX}" y="${viewY}" width="${viewWidth}" height="${viewHeight}" fill="#0a0a0a" />`,
    edgeMarkup,
    nodeMarkup,
    `</svg>`,
  ]
    .filter(Boolean)
    .join("\n");
}

export { svgToPngDataUrl as generateFlowDiagramPngDataUrl } from "../../svgToPngDataUrl";

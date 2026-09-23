import type {
  FlowEdge,
  FlowEdgeArrow,
  FlowEdgeLineStyle,
  FlowNode,
  FlowNodeType,
  FlowPage,
  FlowPosition,
  RichText,
} from "../types/flow.types";
import { richTextToPlainText } from "./richText";

interface NodeExtent {
  width: number;
  height: number;
}

const NODE_EXTENTS: Record<FlowNodeType, NodeExtent> = {
  start: { width: 100, height: 100 },
  end: { width: 100, height: 100 },
  process: { width: 150, height: 56 },
  decision: { width: 160, height: 120 },
  input: { width: 150, height: 56 },
  output: { width: 150, height: 56 },
  rectangle: { width: 150, height: 56 },
  roundedRectangle: { width: 150, height: 56 },
  ellipse: { width: 150, height: 90 },
  diamond: { width: 160, height: 120 },
  parallelogram: { width: 150, height: 56 },
  triangle: { width: 150, height: 110 },
  hexagon: { width: 170, height: 90 },
  cylinder: { width: 130, height: 90 },
  cloud: { width: 160, height: 90 },
  document: { width: 150, height: 70 },
  text: { width: 60, height: 24 },
  container: { width: 320, height: 220 },
  actor: { width: 60, height: 110 },
  package: { width: 160, height: 100 },
  note: { width: 150, height: 90 },
};

const ACCENT_COLORS: Partial<Record<FlowNodeType, string>> = {
  start: "#16a34a",
  end: "#dc2626",
  process: "#64748b",
  decision: "#d97706",
  input: "#0891b2",
  output: "#7c3aed",
  rectangle: "#64748b",
  roundedRectangle: "#64748b",
  ellipse: "#0ea5e9",
  diamond: "#d97706",
  parallelogram: "#0891b2",
  triangle: "#ca8a04",
  hexagon: "#059669",
  cylinder: "#6366f1",
  cloud: "#38bdf8",
  document: "#14b8a6",
  actor: "#eab308",
  package: "#0d9488",
  note: "#a855f7",
};

const SURFACE_COLOR = "#121214";
const TEXT_COLOR = "#ffffff";
const MARGIN = 40;

function nodeExtent(node: FlowNode): NodeExtent {
  return NODE_EXTENTS[node.type];
}

function nodeCenter(node: FlowNode): FlowPosition {
  const extent = nodeExtent(node);
  return { x: node.position.x + extent.width / 2, y: node.position.y + extent.height / 2 };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function computeBounds(page: FlowPage): { minX: number; minY: number; maxX: number; maxY: number } {
  if (page.nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of page.nodes) {
    const extent = nodeExtent(node);
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + extent.width);
    maxY = Math.max(maxY, node.position.y + extent.height);
  }
  return { minX, minY, maxX, maxY };
}

function nodeTransform(node: FlowNode): string | undefined {
  const rotation = node.style?.rotation;
  if (!rotation) return undefined;
  const center = nodeCenter(node);
  return `rotate(${rotation} ${center.x} ${center.y})`;
}

function shapeAttributes(node: FlowNode): string {
  const fill = node.style?.fill ?? ACCENT_COLORS[node.type] ?? SURFACE_COLOR;
  const stroke = node.style?.stroke ?? ACCENT_COLORS[node.type] ?? "none";
  const strokeWidth = node.style?.strokeWidth ?? 3;
  const opacity = node.style?.opacity !== undefined ? node.style.opacity / 100 : 1;
  return `fill="${escapeXml(fill)}" stroke="${escapeXml(stroke)}" stroke-width="${strokeWidth}" opacity="${opacity}"`;
}

function polygonPoints(node: FlowNode, ratios: Array<[number, number]>): string {
  const { x, y } = node.position;
  const { width, height } = nodeExtent(node);
  return ratios.map(([rx, ry]) => `${x + rx * width},${y + ry * height}`).join(" ");
}

const POLYGON_SHAPES: Partial<Record<FlowNodeType, Array<[number, number]>>> = {
  decision: [
    [0.5, 0],
    [1, 0.5],
    [0.5, 1],
    [0, 0.5],
  ],
  diamond: [
    [0.5, 0],
    [1, 0.5],
    [0.5, 1],
    [0, 0.5],
  ],
  input: [
    [0.15, 0],
    [1, 0],
    [0.85, 1],
    [0, 1],
  ],
  output: [
    [0, 0],
    [0.85, 0],
    [1, 1],
    [0.15, 1],
  ],
  parallelogram: [
    [0.18, 0],
    [1, 0],
    [0.82, 1],
    [0, 1],
  ],
  triangle: [
    [0.5, 0],
    [1, 1],
    [0, 1],
  ],
  hexagon: [
    [0.25, 0],
    [0.75, 0],
    [1, 0.5],
    [0.75, 1],
    [0.25, 1],
    [0, 0.5],
  ],
};

function documentPathData(node: FlowNode): string {
  const { x, y } = node.position;
  const { width, height } = nodeExtent(node);
  const points: Array<[number, number]> = [
    [0, 0],
    [1, 0],
    [1, 0.88],
    [0.75, 1],
    [0.5, 0.88],
    [0.25, 1],
    [0, 0.88],
  ];
  const commands = points.map(([rx, ry], index) => {
    const px = x + rx * width;
    const py = y + ry * height;
    return `${index === 0 ? "M" : "L"}${px},${py}`;
  });
  return `${commands.join(" ")} Z`;
}

function renderShape(node: FlowNode): string {
  const { x, y } = node.position;
  const { width, height } = nodeExtent(node);
  const attrs = shapeAttributes(node);
  const transform = nodeTransform(node);
  const transformAttr = transform ? ` transform="${escapeXml(transform)}"` : "";

  if (node.type === "ellipse" || node.type === "start" || node.type === "end") {
    const rx = width / 2;
    const ry = height / 2;
    return `<ellipse cx="${x + rx}" cy="${y + ry}" rx="${rx}" ry="${ry}" ${attrs}${transformAttr} />`;
  }

  if (node.type === "roundedRectangle") {
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="16" ry="16" ${attrs}${transformAttr} />`;
  }

  if (node.type === "text") {
    return "";
  }

  if (node.type === "container") {
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" ry="8" stroke-dasharray="6 4" ${attrs}${transformAttr} />`;
  }

  if (node.type === "cylinder") {
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${width * 0.18}" ry="18" ${attrs}${transformAttr} />`;
  }

  if (node.type === "cloud") {
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${width * 0.3}" ry="${height * 0.4}" ${attrs}${transformAttr} />`;
  }

  if (node.type === "document") {
    return `<path d="${documentPathData(node)}" ${attrs}${transformAttr} />`;
  }

  const polygon = POLYGON_SHAPES[node.type];
  if (polygon) {
    return `<polygon points="${polygonPoints(node, polygon)}" ${attrs}${transformAttr} />`;
  }

  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="2" ry="2" ${attrs}${transformAttr} />`;
}

function runTspan(run: RichText["runs"][number]): string {
  const styles: string[] = [];
  if (run.bold) styles.push("font-weight:700");
  if (run.italic) styles.push("font-style:italic");
  const decorations = [run.underline ? "underline" : "", run.strike ? "line-through" : ""]
    .filter(Boolean)
    .join(" ");
  if (decorations) styles.push(`text-decoration:${decorations}`);
  if (run.color) styles.push(`fill:${run.color}`);
  if (run.fontFamily) styles.push(`font-family:${run.fontFamily}`);
  if (run.fontSize) styles.push(`font-size:${run.fontSize}px`);
  const styleAttr = styles.length > 0 ? ` style="${escapeXml(styles.join(";"))}"` : "";
  return `<tspan${styleAttr}>${escapeXml(run.text)}</tspan>`;
}

function textAnchorFor(align: RichText["align"]): string {
  if (align === "left") return "start";
  if (align === "right") return "end";
  return "middle";
}

function renderNodeLabel(node: FlowNode): string {
  const label = node.data.label;
  if (label.runs.every((run) => run.text.length === 0)) return "";
  const center = nodeCenter(node);
  const anchor = textAnchorFor(label.align);
  const transform = nodeTransform(node);
  const transformAttr = transform ? ` transform="${escapeXml(transform)}"` : "";
  const tspans = label.runs.map(runTspan).join("");
  return `<text x="${center.x}" y="${center.y}" text-anchor="${anchor}" dominant-baseline="middle" fill="${TEXT_COLOR}" font-size="13" font-family="sans-serif"${transformAttr}>${tspans}</text>`;
}

function renderNode(node: FlowNode): string {
  const shape = renderShape(node);
  const label = renderNodeLabel(node);
  return [shape, label].filter(Boolean).join("\n");
}

function connectionPoint(from: FlowPosition, to: FlowPosition, extent: NodeExtent): FlowPosition {
  const halfWidth = extent.width / 2;
  const halfHeight = extent.height / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return from;
  const scaleX = halfWidth / Math.abs(dx || Number.EPSILON);
  const scaleY = halfHeight / Math.abs(dy || Number.EPSILON);
  const scale = Math.min(scaleX, scaleY);
  return { x: from.x + dx * scale, y: from.y + dy * scale };
}

const EDGE_DASH_PATTERNS: Record<FlowEdgeLineStyle, string | undefined> = {
  solid: undefined,
  dashed: "6 4",
  dotted: "1 4",
};

function resolvedEdgeArrowEnds(edge: FlowEdge): { start: FlowEdgeArrow; end: FlowEdgeArrow } {
  if (edge.arrowStart !== undefined || edge.arrowEnd !== undefined) {
    return { start: edge.arrowStart ?? "none", end: edge.arrowEnd ?? "none" };
  }
  const legacy = edge.arrow ?? "forward";
  if (legacy === "both") return { start: "both", end: "both" };
  if (legacy === "none") return { start: "none", end: "none" };
  return { start: "none", end: "forward" };
}

function edgePathData(from: FlowPosition, to: FlowPosition, routing: FlowEdge["routing"]): string {
  if (routing === "orthogonal") {
    const midX = from.x + (to.x - from.x) / 2;
    return `M${from.x},${from.y} L${midX},${from.y} L${midX},${to.y} L${to.x},${to.y}`;
  }
  if (routing === "straight") {
    return `M${from.x},${from.y} L${to.x},${to.y}`;
  }
  const dx = (to.x - from.x) / 2;
  const c1 = { x: from.x + dx, y: from.y };
  const c2 = { x: to.x - dx, y: to.y };
  return `M${from.x},${from.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${to.x},${to.y}`;
}

function renderEdge(edge: FlowEdge, nodesById: Map<string, FlowNode>): string {
  const source = nodesById.get(edge.source);
  const target = nodesById.get(edge.target);
  if (!source || !target) return "";

  const sourceCenter = nodeCenter(source);
  const targetCenter = nodeCenter(target);
  const from = connectionPoint(sourceCenter, targetCenter, nodeExtent(source));
  const to = connectionPoint(targetCenter, sourceCenter, nodeExtent(target));

  const stroke = edge.stroke ?? "#94a3b8";
  const strokeWidth = edge.strokeWidth ?? 2;
  const dash = EDGE_DASH_PATTERNS[edge.lineStyle ?? "solid"];
  const dashAttr = dash ? ` stroke-dasharray="${dash}"` : "";
  const { start, end } = resolvedEdgeArrowEnds(edge);
  const startMarkerId = edge.arrowStartShape === "open" ? "wec-flow-arrow-start-open" : "wec-flow-arrow-start";
  const endMarkerId = edge.arrowEndShape === "open" ? "wec-flow-arrow-end-open" : "wec-flow-arrow-end";
  const markerStartAttr = start !== "none" ? ` marker-start="url(#${startMarkerId})"` : "";
  const markerEndAttr = end !== "none" ? ` marker-end="url(#${endMarkerId})"` : "";

  const path = `<path d="${edgePathData(from, to, edge.routing)}" fill="none" stroke="${escapeXml(stroke)}" stroke-width="${strokeWidth}"${dashAttr}${markerStartAttr}${markerEndAttr} />`;

  if (!edge.label) return path;
  const plainText = richTextToPlainText(edge.label);
  if (plainText.length === 0) return path;
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const label = `<text x="${midX}" y="${midY - 6}" text-anchor="middle" fill="${TEXT_COLOR}" font-size="12" font-family="sans-serif">${escapeXml(plainText)}</text>`;
  return `${path}\n${label}`;
}

function renderMarkers(): string {
  return `<defs>
<marker id="wec-flow-arrow-end" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
<path d="M0,0 L10,5 L0,10 Z" fill="#94a3b8" />
</marker>
<marker id="wec-flow-arrow-start" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto">
<path d="M10,0 L0,5 L10,10 Z" fill="#94a3b8" />
</marker>
<marker id="wec-flow-arrow-end-open" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
<path d="M0,0 L10,5 L0,10" fill="none" stroke="#94a3b8" stroke-width="1.5" />
</marker>
<marker id="wec-flow-arrow-start-open" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto">
<path d="M10,0 L0,5 L10,10" fill="none" stroke="#94a3b8" stroke-width="1.5" />
</marker>
</defs>`;
}

export function exportPageToSVG(page: FlowPage): string {
  const bounds = computeBounds(page);
  const width = bounds.maxX - bounds.minX + MARGIN * 2;
  const height = bounds.maxY - bounds.minY + MARGIN * 2;
  const viewBoxX = bounds.minX - MARGIN;
  const viewBoxY = bounds.minY - MARGIN;

  const nodesById = new Map(page.nodes.map((node) => [node.id, node]));
  const backgroundRect = page.background
    ? `<rect x="${viewBoxX}" y="${viewBoxY}" width="${width}" height="${height}" fill="${escapeXml(page.background)}" />`
    : "";

  const nodesMarkup = page.nodes.map(renderNode).join("\n");
  const edgesMarkup = page.edges.map((edge) => renderEdge(edge, nodesById)).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${viewBoxX} ${viewBoxY} ${width} ${height}" width="${width}" height="${height}">
${renderMarkers()}
${backgroundRect}
${edgesMarkup}
${nodesMarkup}
</svg>`;
}

import type {
  FlowEdge,
  FlowEdgeArrow,
  FlowEdgeArrowShape,
  FlowEdgeLineStyle,
  FlowEdgeRouting,
  FlowNode,
} from "../types/flow.types";

export interface CommonValue<T> {
  value: T | undefined;
  mixed: boolean;
}

function commonValue<T, K extends unknown>(items: K[], read: (item: K) => T | undefined): CommonValue<T> {
  if (items.length === 0) return { value: undefined, mixed: false };
  const values = items.map(read);
  const first = values[0];
  const mixed = values.some((value) => value !== first);
  return { value: mixed ? undefined : first, mixed };
}

export interface CommonNodeStyle {
  fill: CommonValue<string>;
  stroke: CommonValue<string>;
  strokeWidth: CommonValue<number>;
  lineStyle: CommonValue<FlowEdgeLineStyle>;
  opacity: CommonValue<number>;
  rotation: CommonValue<number>;
  perimeter: CommonValue<number>;
  shadow: CommonValue<boolean>;
  glow: CommonValue<boolean>;
  cornerRadius: CommonValue<number>;
}

export function commonNodeStyle(nodes: FlowNode[]): CommonNodeStyle {
  return {
    fill: commonValue(nodes, (node) => node.style?.fill),
    stroke: commonValue(nodes, (node) => node.style?.stroke),
    strokeWidth: commonValue(nodes, (node) => node.style?.strokeWidth),
    lineStyle: commonValue(nodes, (node) => node.style?.lineStyle),
    opacity: commonValue(nodes, (node) => node.style?.opacity),
    rotation: commonValue(nodes, (node) => node.style?.rotation),
    perimeter: commonValue(nodes, (node) => node.style?.perimeter),
    shadow: commonValue(nodes, (node) => node.style?.shadow ?? false),
    glow: commonValue(nodes, (node) => node.style?.glow ?? false),
    cornerRadius: commonValue(nodes, (node) => node.style?.cornerRadius),
  };
}

export interface CommonEdgeStyle {
  stroke: CommonValue<string>;
  strokeWidth: CommonValue<number>;
  lineStyle: CommonValue<FlowEdgeLineStyle>;
  arrowStart: CommonValue<FlowEdgeArrow>;
  arrowEnd: CommonValue<FlowEdgeArrow>;
  arrowStartShape: CommonValue<FlowEdgeArrowShape>;
  arrowEndShape: CommonValue<FlowEdgeArrowShape>;
  routing: CommonValue<FlowEdgeRouting>;
}

export function commonEdgeStyle(edges: FlowEdge[]): CommonEdgeStyle {
  return {
    stroke: commonValue(edges, (edge) => edge.stroke),
    strokeWidth: commonValue(edges, (edge) => edge.strokeWidth),
    lineStyle: commonValue(edges, (edge) => edge.lineStyle),
    arrowStart: commonValue(edges, (edge) => edge.arrowStart ?? edge.arrow),
    arrowEnd: commonValue(edges, (edge) => edge.arrowEnd ?? edge.arrow),
    arrowStartShape: commonValue(edges, (edge) => edge.arrowStartShape ?? "triangle"),
    arrowEndShape: commonValue(edges, (edge) => edge.arrowEndShape ?? "triangle"),
    routing: commonValue(edges, (edge) => edge.routing ?? "straight"),
  };
}

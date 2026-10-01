export interface XYPosition {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface Rect extends XYPosition, Dimensions {}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export type HandleSide = "top" | "right" | "bottom" | "left";
export type HandleKind = "source" | "target";

export type PropertyValue = string | number | boolean | null;

export interface NodeData {
  label: string;
  description?: string;

  properties: Record<string, PropertyValue>;

  meta?: Record<string, unknown>;
}

export interface FlowNode<D extends NodeData = NodeData> {
  id: string;

  type: string;

  position: XYPosition;

  width?: number;
  height?: number;
  data: D;

  parentId?: string;
}

export type EdgePathType = "bezier" | "straight" | "step";

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;

  type?: EdgePathType;

  bend?: number;
  animated?: boolean;

  data?: Record<string, unknown>;
}

export interface Connection {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface FlowSnapshot {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export const FLOW_JSON_VERSION = 1;

export interface FlowJSON extends FlowSnapshot {
  version: number;
  viewport?: Viewport;
  meta?: { name?: string; [key: string]: unknown };
}

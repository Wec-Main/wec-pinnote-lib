/**
 * Core data model of a flow. These types are framework-agnostic: nothing in
 * here depends on React, so the same model can be used by a future execution
 * engine, a persistence layer or an AI that reads/writes flows.
 */

export interface XYPosition {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface Rect extends XYPosition, Dimensions {}

/** Viewport transform: screen = flow * zoom + (x, y). */
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export type HandleSide = 'top' | 'right' | 'bottom' | 'left';
export type HandleKind = 'source' | 'target';

export type PropertyValue = string | number | boolean | null;

export interface NodeData {
  label: string;
  description?: string;
  /** Free-form, user editable key/value properties. */
  properties: Record<string, PropertyValue>;
  /** Extension point for plugins; never interpreted by the core. */
  meta?: Record<string, unknown>;
}

export interface FlowNode<D extends NodeData = NodeData> {
  id: string;
  /** Key into the node type registry (e.g. "process", "decision"). */
  type: string;
  /** Top-left corner in flow coordinates. */
  position: XYPosition;
  /** Explicit size. Falls back to the node type's default size. */
  width?: number;
  height?: number;
  data: D;
  /** Reserved for nested sub-flows. Not interpreted yet. */
  parentId?: string;
}

export type EdgePathType = 'bezier' | 'straight' | 'step';

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  /** Path style; falls back to the editor's default edge type. */
  type?: EdgePathType;
  /** Position of the adjustable middle segment of a step route (x or y, depending on the source side). */
  bend?: number;
  animated?: boolean;
  /** Extension point for plugins; never interpreted by the core. */
  data?: Record<string, unknown>;
}

export interface Connection {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

/** The persistent part of a flow: what undo/redo and export operate on. */
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

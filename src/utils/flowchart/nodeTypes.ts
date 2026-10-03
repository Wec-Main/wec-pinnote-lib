import type { ComponentType, ReactNode } from "react";
import type {
  Dimensions,
  FlowNode,
  HandleKind,
  HandleSide,
  NodeData,
  PropertyValue,
} from "../../types/flowchart.types";

export type NodeShape =
  | "rounded"
  | "pill"
  | "diamond"
  | "parallelogram"
  | "rectangle"
  | "subprocess"
  | "circle"
  | "square"
  | "ellipse"
  | "triangle"
  | "hexagon"
  | "cylinder"
  | "cloud"
  | "actor"
  | "swimlane"
  | "swimlaneVertical"
  | "text";

export function isLaneShape(shape: NodeShape): boolean {
  return shape === "swimlane" || shape === "swimlaneVertical";
}

export type NodeRole = "start" | "end" | "default";

export interface HandleDefinition {
  id: string;
  kind: HandleKind;
  side: HandleSide;

  label?: string;

  maxConnections?: number;
}

export type PropertyFieldType = "text" | "textarea" | "number" | "boolean" | "select";

export interface PropertyField {
  key: string;
  label: string;
  type: PropertyFieldType;
  options?: string[];
  defaultValue?: PropertyValue;
  placeholder?: string;
}

export interface NodeComponentProps {
  node: FlowNode;
  definition: NodeTypeDefinition;
  selected: boolean;
  width: number;
  height: number;

  editing?: boolean;

  onEditDone?: () => void;
}

export type BuiltInIcon =
  | "play"
  | "stop"
  | "cog"
  | "branch"
  | "input"
  | "output"
  | "puzzle"
  | "globe"
  | "mail"
  | "database"
  | "clock"
  | "subprocess"
  | "plug"
  | "circleShape"
  | "squareShape"
  | "rectangleShape"
  | "roundedRectShape"
  | "textShape"
  | "ellipseShape"
  | "triangleShape"
  | "hexagonShape"
  | "cylinderShape"
  | "cloudShape"
  | "actor"
  | "swimlaneH"
  | "swimlaneV";

export interface NodeTypeDefinition {
  type: string;
  label: string;
  description?: string;

  category?: string;
  role?: NodeRole;

  color: string;
  icon?: BuiltInIcon | ReactNode;
  shape: NodeShape;
  defaultSize: Dimensions;
  minSize?: Dimensions;
  resizable?: boolean;
  handles: HandleDefinition[];
  defaultData?: Partial<NodeData>;
  propertySchema?: PropertyField[];

  maxIncoming?: number;
  maxOutgoing?: number;

  defaultEdgeLabels?: Record<string, string>;

  component?: ComponentType<NodeComponentProps>;
}

const inOut = (): HandleDefinition[] => [
  { id: "in-top", kind: "target", side: "top" },
  { id: "out-top", kind: "source", side: "top" },
  { id: "in-bottom", kind: "target", side: "bottom" },
  { id: "out-bottom", kind: "source", side: "bottom" },
  { id: "in-left", kind: "target", side: "left" },
  { id: "out-left", kind: "source", side: "left" },
  { id: "in-right", kind: "target", side: "right" },
  { id: "out-right", kind: "source", side: "right" },
];

export const builtInNodeTypes: NodeTypeDefinition[] = [
  {
    type: "start",
    label: "Start",
    description: "Entry point of the flow",
    category: "Flow control",
    role: "start",
    color: "#10b981",
    icon: "play",
    shape: "pill",
    defaultSize: { width: 180, height: 56 },
    minSize: { width: 120, height: 44 },
    resizable: true,
    handles: [
      { id: "out", kind: "source", side: "bottom" },
      { id: "out-top", kind: "source", side: "top" },
      { id: "out-left", kind: "source", side: "left" },
      { id: "out-right", kind: "source", side: "right" },
    ],
    maxIncoming: 0,
    defaultData: { label: "Start" },
  },
  {
    type: "process",
    label: "Process",
    description: "A step that performs work",
    category: "Flow control",
    color: "#3b82f6",
    icon: "cog",
    shape: "rounded",
    defaultSize: { width: 220, height: 76 },
    minSize: { width: 140, height: 56 },
    resizable: true,
    handles: inOut(),
    defaultData: { label: "Process" },
  },
  {
    type: "decision",
    label: "Decision",
    description: "Branches on a condition",
    category: "Flow control",
    color: "#f59e0b",
    icon: "branch",
    shape: "diamond",
    defaultSize: { width: 200, height: 120 },
    minSize: { width: 140, height: 90 },
    resizable: true,
    handles: [
      { id: "in-top", kind: "target", side: "top" },
      { id: "in-left", kind: "target", side: "left" },
      { id: "in-right", kind: "target", side: "right" },
      { id: "in-bottom", kind: "target", side: "bottom" },
      { id: "yes", kind: "source", side: "bottom", label: "Yes" },
      { id: "no", kind: "source", side: "right", label: "No" },
      { id: "out-top", kind: "source", side: "top" },
      { id: "out-left", kind: "source", side: "left" },
    ],
    defaultEdgeLabels: { yes: "Yes", no: "No" },
    defaultData: { label: "Condition?" },
  },
  {
    type: "end",
    label: "End",
    description: "Terminates the flow",
    category: "Flow control",
    role: "end",
    color: "#ef4444",
    icon: "stop",
    shape: "pill",
    defaultSize: { width: 180, height: 56 },
    minSize: { width: 120, height: 44 },
    resizable: true,
    handles: [
      { id: "in", kind: "target", side: "top" },
      { id: "in-bottom", kind: "target", side: "bottom" },
      { id: "in-left", kind: "target", side: "left" },
      { id: "in-right", kind: "target", side: "right" },
    ],
    maxOutgoing: 0,
    defaultData: { label: "End" },
  },
  {
    type: "subprocess",
    label: "Sub Process",
    description: "Runs a nested process",
    category: "Flow control",
    color: "#6366f1",
    icon: "subprocess",
    shape: "subprocess",
    defaultSize: { width: 220, height: 76 },
    minSize: { width: 140, height: 56 },
    resizable: true,
    handles: inOut(),
    defaultData: { label: "Sub Process" },
  },
  {
    type: "integration",
    label: "Integration",
    description: "Connects to an external system or API",
    category: "Flow control",
    color: "#0891b2",
    icon: "plug",
    shape: "rounded",
    defaultSize: { width: 220, height: 76 },
    minSize: { width: 140, height: 56 },
    resizable: true,
    handles: inOut(),
    defaultData: { label: "Integration" },
  },
  {
    type: "circle",
    label: "Circle",
    description: "Generic round shape",
    category: "General",
    color: "#0ea5e9",
    icon: "circleShape",
    shape: "circle",
    defaultSize: { width: 100, height: 100 },
    minSize: { width: 48, height: 48 },
    resizable: true,
    handles: inOut(),
    defaultData: { label: "Circle" },
  },
  {
    type: "square",
    label: "Square",
    description: "Generic square shape",
    category: "General",
    color: "#78716c",
    icon: "squareShape",
    shape: "square",
    defaultSize: { width: 100, height: 100 },
    minSize: { width: 48, height: 48 },
    resizable: true,
    handles: inOut(),
    defaultData: { label: "Square" },
  },
  {
    type: "rectangle",
    label: "Rectangle",
    description: "Generic rectangle shape",
    category: "General",
    color: "#64748b",
    icon: "rectangleShape",
    shape: "rectangle",
    defaultSize: { width: 140, height: 70 },
    minSize: { width: 48, height: 32 },
    resizable: true,
    handles: inOut(),
    defaultData: { label: "Rectangle" },
  },
  {
    type: "roundedRectangle",
    label: "Rounded Rectangle",
    description: "Generic rounded rectangle shape",
    category: "General",
    color: "#0d9488",
    icon: "roundedRectShape",
    shape: "rounded",
    defaultSize: { width: 140, height: 70 },
    minSize: { width: 48, height: 32 },
    resizable: true,
    handles: inOut(),
    defaultData: { label: "Rounded Rectangle" },
  },
  {
    type: "ellipse",
    label: "Ellipse",
    description: "Generic oval shape",
    category: "General",
    color: "#a855f7",
    icon: "ellipseShape",
    shape: "ellipse",
    defaultSize: { width: 140, height: 80 },
    minSize: { width: 48, height: 32 },
    resizable: true,
    handles: inOut(),
    defaultData: { label: "Ellipse" },
  },
  {
    type: "triangle",
    label: "Triangle",
    description: "Generic triangle shape",
    category: "General",
    color: "#eab308",
    icon: "triangleShape",
    shape: "triangle",
    defaultSize: { width: 120, height: 100 },
    minSize: { width: 48, height: 40 },
    resizable: true,
    handles: inOut(),
    defaultData: { label: "Triangle" },
  },
  {
    type: "hexagon",
    label: "Hexagon",
    description: "Generic hexagon shape",
    category: "General",
    color: "#f97316",
    icon: "hexagonShape",
    shape: "hexagon",
    defaultSize: { width: 160, height: 80 },
    minSize: { width: 60, height: 40 },
    resizable: true,
    handles: inOut(),
    defaultData: { label: "Hexagon" },
  },
  {
    type: "cylinder",
    label: "Cylinder",
    description: "Generic data store shape",
    category: "General",
    color: "#14b8a6",
    icon: "cylinderShape",
    shape: "cylinder",
    defaultSize: { width: 120, height: 100 },
    minSize: { width: 48, height: 48 },
    resizable: true,
    handles: inOut(),
    defaultData: { label: "Cylinder" },
  },
  {
    type: "text",
    label: "Text",
    description: "Plain text label with no outline",
    category: "General",
    color: "#475569",
    icon: "textShape",
    shape: "text",
    defaultSize: { width: 120, height: 32 },
    minSize: { width: 32, height: 20 },
    resizable: true,
    handles: inOut(),
    defaultData: { label: "Text" },
  },
  {
    type: "actor",
    label: "Person",
    description: "A user, role or external actor",
    category: "General",
    color: "#ec4899",
    icon: "actor",
    shape: "actor",
    defaultSize: { width: 90, height: 120 },
    minSize: { width: 50, height: 70 },
    resizable: true,
    handles: inOut(),
    defaultData: { label: "User" },
  },
  {
    type: "swimlane",
    label: "Horizontal Swimlane",
    description: "A row grouping the steps one person or team owns",
    category: "General",
    color: "#8b5cf6",
    icon: "swimlaneH",
    shape: "swimlane",
    defaultSize: { width: 720, height: 200 },
    minSize: { width: 200, height: 80 },
    resizable: true,
    handles: [],
    defaultData: { label: "Lane" },
  },
  {
    type: "swimlaneVertical",
    label: "Vertical Swimlane",
    description: "A column grouping the steps one person or team owns",
    category: "General",
    color: "#06b6d4",
    icon: "swimlaneV",
    shape: "swimlaneVertical",
    defaultSize: { width: 240, height: 520 },
    minSize: { width: 100, height: 160 },
    resizable: true,
    handles: [],
    defaultData: { label: "Lane" },
  },
];

export const fallbackNodeType: NodeTypeDefinition = {
  type: "__unknown__",
  label: "Unknown",
  color: "#94a3b8",
  icon: "puzzle",
  shape: "rectangle",
  defaultSize: { width: 200, height: 70 },
  resizable: true,
  handles: inOut(),
};

export class NodeTypeRegistry {
  private readonly defs = new Map<string, NodeTypeDefinition>();

  constructor(definitions: NodeTypeDefinition[] = builtInNodeTypes) {
    definitions.forEach((d) => this.register(d));
  }

  register(definition: NodeTypeDefinition): void {
    this.defs.set(definition.type, definition);
  }

  unregister(type: string): void {
    this.defs.delete(type);
  }

  has(type: string): boolean {
    return this.defs.has(type);
  }

  get(type: string): NodeTypeDefinition {
    return this.defs.get(type) ?? fallbackNodeType;
  }

  list(): NodeTypeDefinition[] {
    return [...this.defs.values()];
  }
}

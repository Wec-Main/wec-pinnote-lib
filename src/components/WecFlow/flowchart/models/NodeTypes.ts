import type { ComponentType, ReactNode } from 'react';
import type { Dimensions, FlowNode, HandleKind, HandleSide, NodeData, PropertyValue } from './FlowTypes';

/** Visual outline drawn behind a node's content. */
export type NodeShape =
  | 'rounded'
  | 'pill'
  | 'diamond'
  | 'parallelogram'
  | 'rectangle'
  | 'subprocess'
  | 'circle'
  | 'square'
  | 'ellipse'
  | 'triangle'
  | 'hexagon'
  | 'cylinder'
  | 'cloud'
  | 'text';

/** Semantic role used by the validator (lets plugins declare their own start/end nodes). */
export type NodeRole = 'start' | 'end' | 'default';

export interface HandleDefinition {
  id: string;
  kind: HandleKind;
  side: HandleSide;
  /** Short caption shown next to the handle (e.g. "Yes"). */
  label?: string;
  /** Max edges attached to this handle. Undefined = unlimited. */
  maxConnections?: number;
}

export type PropertyFieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'select';

/** Declarative description of a typed property shown in the properties panel. */
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
  /** True while the node's label is open for inline editing on the canvas. */
  editing?: boolean;
  /** Call once inline editing should close (blur, Enter, Escape). */
  onEditDone?: () => void;
}

export type BuiltInIcon =
  | 'play'
  | 'stop'
  | 'cog'
  | 'branch'
  | 'input'
  | 'output'
  | 'puzzle'
  | 'globe'
  | 'mail'
  | 'database'
  | 'clock'
  | 'subprocess'
  | 'circleShape'
  | 'squareShape'
  | 'rectangleShape'
  | 'roundedRectShape'
  | 'textShape'
  | 'ellipseShape'
  | 'triangleShape'
  | 'hexagonShape'
  | 'cylinderShape'
  | 'cloudShape';

/**
 * Everything the editor needs to know about a node type. Registering a new
 * definition is the plugin mechanism for custom nodes.
 */
export interface NodeTypeDefinition {
  type: string;
  label: string;
  description?: string;
  /** Palette group. */
  category?: string;
  role?: NodeRole;
  /** Accent color (any CSS color). */
  color: string;
  icon?: BuiltInIcon | ReactNode;
  shape: NodeShape;
  defaultSize: Dimensions;
  minSize?: Dimensions;
  resizable?: boolean;
  handles: HandleDefinition[];
  defaultData?: Partial<NodeData>;
  propertySchema?: PropertyField[];
  /** Total incoming / outgoing edge limits. Undefined = unlimited. */
  maxIncoming?: number;
  maxOutgoing?: number;
  /** Default label for edges leaving a given source handle (handleId -> label). */
  defaultEdgeLabels?: Record<string, string>;
  /** Optional custom renderer for the node body. */
  component?: ComponentType<NodeComponentProps>;
}

const inOut = (extra: HandleDefinition[] = []): HandleDefinition[] => [
  { id: 'in', kind: 'target', side: 'top' },
  { id: 'out', kind: 'source', side: 'bottom' },
  ...extra,
];

export const builtInNodeTypes: NodeTypeDefinition[] = [
  {
    type: 'start',
    label: 'Start',
    description: 'Entry point of the flow',
    category: 'Flow control',
    role: 'start',
    color: '#10b981',
    icon: 'play',
    shape: 'pill',
    defaultSize: { width: 180, height: 56 },
    minSize: { width: 120, height: 44 },
    resizable: true,
    handles: [
      { id: 'out', kind: 'source', side: 'bottom' },
      { id: 'out-top', kind: 'source', side: 'top' },
      { id: 'out-left', kind: 'source', side: 'left' },
      { id: 'out-right', kind: 'source', side: 'right' },
    ],
    maxIncoming: 0,
    defaultData: { label: 'Start' },
  },
  {
    type: 'process',
    label: 'Process',
    description: 'A step that performs work',
    category: 'Flow control',
    color: '#3b82f6',
    icon: 'cog',
    shape: 'rounded',
    defaultSize: { width: 220, height: 76 },
    minSize: { width: 140, height: 56 },
    resizable: true,
    handles: inOut([
      { id: 'in-left', kind: 'target', side: 'left' },
      { id: 'out-right', kind: 'source', side: 'right' },
    ]),
    defaultData: { label: 'Process' },
  },
  {
    type: 'decision',
    label: 'Decision',
    description: 'Branches on a condition',
    category: 'Flow control',
    color: '#f59e0b',
    icon: 'branch',
    shape: 'diamond',
    defaultSize: { width: 200, height: 120 },
    minSize: { width: 140, height: 90 },
    resizable: true,
    handles: [
      { id: 'in', kind: 'target', side: 'top' },
      { id: 'yes', kind: 'source', side: 'bottom', label: 'Yes' },
      { id: 'no', kind: 'source', side: 'right', label: 'No' },
      { id: 'in-left', kind: 'target', side: 'left' },
    ],
    defaultEdgeLabels: { yes: 'Yes', no: 'No' },
    defaultData: { label: 'Condition?' },
  },
  {
    type: 'end',
    label: 'End',
    description: 'Terminates the flow',
    category: 'Flow control',
    role: 'end',
    color: '#ef4444',
    icon: 'stop',
    shape: 'pill',
    defaultSize: { width: 180, height: 56 },
    minSize: { width: 120, height: 44 },
    resizable: true,
    handles: [
      { id: 'in', kind: 'target', side: 'top' },
      { id: 'in-bottom', kind: 'target', side: 'bottom' },
      { id: 'in-left', kind: 'target', side: 'left' },
      { id: 'in-right', kind: 'target', side: 'right' },
    ],
    maxOutgoing: 0,
    defaultData: { label: 'End' },
  },
  {
    type: 'subprocess',
    label: 'Sub Process',
    description: 'Runs a nested process',
    category: 'Flow control',
    color: '#6366f1',
    icon: 'subprocess',
    shape: 'subprocess',
    defaultSize: { width: 220, height: 76 },
    minSize: { width: 140, height: 56 },
    resizable: true,
    handles: inOut([
      { id: 'in-left', kind: 'target', side: 'left' },
      { id: 'out-right', kind: 'source', side: 'right' },
    ]),
    defaultData: { label: 'Sub Process' },
  },
  {
    type: 'circle',
    label: 'Circle',
    description: 'Generic round shape',
    category: 'General',
    color: '#0ea5e9',
    icon: 'circleShape',
    shape: 'circle',
    defaultSize: { width: 100, height: 100 },
    minSize: { width: 48, height: 48 },
    resizable: true,
    handles: inOut([
      { id: 'in-left', kind: 'target', side: 'left' },
      { id: 'out-right', kind: 'source', side: 'right' },
    ]),
    defaultData: { label: 'Circle' },
  },
  {
    type: 'square',
    label: 'Square',
    description: 'Generic square shape',
    category: 'General',
    color: '#78716c',
    icon: 'squareShape',
    shape: 'square',
    defaultSize: { width: 100, height: 100 },
    minSize: { width: 48, height: 48 },
    resizable: true,
    handles: inOut([
      { id: 'in-left', kind: 'target', side: 'left' },
      { id: 'out-right', kind: 'source', side: 'right' },
    ]),
    defaultData: { label: 'Square' },
  },
  {
    type: 'rectangle',
    label: 'Rectangle',
    description: 'Generic rectangle shape',
    category: 'General',
    color: '#64748b',
    icon: 'rectangleShape',
    shape: 'rectangle',
    defaultSize: { width: 140, height: 70 },
    minSize: { width: 48, height: 32 },
    resizable: true,
    handles: inOut([
      { id: 'in-left', kind: 'target', side: 'left' },
      { id: 'out-right', kind: 'source', side: 'right' },
    ]),
    defaultData: { label: 'Rectangle' },
  },
  {
    type: 'roundedRectangle',
    label: 'Rounded Rectangle',
    description: 'Generic rounded rectangle shape',
    category: 'General',
    color: '#0d9488',
    icon: 'roundedRectShape',
    shape: 'rounded',
    defaultSize: { width: 140, height: 70 },
    minSize: { width: 48, height: 32 },
    resizable: true,
    handles: inOut([
      { id: 'in-left', kind: 'target', side: 'left' },
      { id: 'out-right', kind: 'source', side: 'right' },
    ]),
    defaultData: { label: 'Rounded Rectangle' },
  },
  {
    type: 'ellipse',
    label: 'Ellipse',
    description: 'Generic oval shape',
    category: 'General',
    color: '#a855f7',
    icon: 'ellipseShape',
    shape: 'ellipse',
    defaultSize: { width: 140, height: 80 },
    minSize: { width: 48, height: 32 },
    resizable: true,
    handles: inOut([
      { id: 'in-left', kind: 'target', side: 'left' },
      { id: 'out-right', kind: 'source', side: 'right' },
    ]),
    defaultData: { label: 'Ellipse' },
  },
  {
    type: 'triangle',
    label: 'Triangle',
    description: 'Generic triangle shape',
    category: 'General',
    color: '#eab308',
    icon: 'triangleShape',
    shape: 'triangle',
    defaultSize: { width: 120, height: 100 },
    minSize: { width: 48, height: 40 },
    resizable: true,
    handles: inOut([
      { id: 'in-left', kind: 'target', side: 'left' },
      { id: 'out-right', kind: 'source', side: 'right' },
    ]),
    defaultData: { label: 'Triangle' },
  },
  {
    type: 'hexagon',
    label: 'Hexagon',
    description: 'Generic hexagon shape',
    category: 'General',
    color: '#f97316',
    icon: 'hexagonShape',
    shape: 'hexagon',
    defaultSize: { width: 160, height: 80 },
    minSize: { width: 60, height: 40 },
    resizable: true,
    handles: inOut([
      { id: 'in-left', kind: 'target', side: 'left' },
      { id: 'out-right', kind: 'source', side: 'right' },
    ]),
    defaultData: { label: 'Hexagon' },
  },
  {
    type: 'cylinder',
    label: 'Cylinder',
    description: 'Generic data store shape',
    category: 'General',
    color: '#14b8a6',
    icon: 'cylinderShape',
    shape: 'cylinder',
    defaultSize: { width: 120, height: 100 },
    minSize: { width: 48, height: 48 },
    resizable: true,
    handles: inOut([
      { id: 'in-left', kind: 'target', side: 'left' },
      { id: 'out-right', kind: 'source', side: 'right' },
    ]),
    defaultData: { label: 'Cylinder' },
  },
  {
    type: 'cloud',
    label: 'Cloud',
    description: 'Generic cloud shape',
    category: 'General',
    color: '#38bdf8',
    icon: 'cloudShape',
    shape: 'cloud',
    defaultSize: { width: 160, height: 100 },
    minSize: { width: 60, height: 40 },
    resizable: true,
    handles: inOut([
      { id: 'in-left', kind: 'target', side: 'left' },
      { id: 'out-right', kind: 'source', side: 'right' },
    ]),
    defaultData: { label: 'Cloud' },
  },
  {
    type: 'text',
    label: 'Text',
    description: 'Plain text label with no outline',
    category: 'General',
    color: '#475569',
    icon: 'textShape',
    shape: 'text',
    defaultSize: { width: 120, height: 32 },
    minSize: { width: 32, height: 20 },
    resizable: true,
    handles: inOut([
      { id: 'in-left', kind: 'target', side: 'left' },
      { id: 'out-right', kind: 'source', side: 'right' },
    ]),
    defaultData: { label: 'Text' },
  },
];

/** Used to render nodes whose type is not registered (e.g. imported from elsewhere). */
export const fallbackNodeType: NodeTypeDefinition = {
  type: '__unknown__',
  label: 'Unknown',
  color: '#94a3b8',
  icon: 'puzzle',
  shape: 'rectangle',
  defaultSize: { width: 200, height: 70 },
  resizable: true,
  handles: inOut(),
};

/** Lookup table of node type definitions. */
export class NodeTypeRegistry {
  private readonly defs = new Map<string, NodeTypeDefinition>();

  constructor(definitions: NodeTypeDefinition[] = builtInNodeTypes) {
    definitions.forEach((d) => this.register(d));
  }

  /** Registers (or replaces) a node type. */
  register(definition: NodeTypeDefinition): void {
    this.defs.set(definition.type, definition);
  }

  unregister(type: string): void {
    this.defs.delete(type);
  }

  has(type: string): boolean {
    return this.defs.has(type);
  }

  /** Returns the definition, or the fallback definition for unknown types. */
  get(type: string): NodeTypeDefinition {
    return this.defs.get(type) ?? fallbackNodeType;
  }

  list(): NodeTypeDefinition[] {
    return [...this.defs.values()];
  }
}

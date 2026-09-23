import type { ComponentType, ReactNode } from 'react';
import type { Dimensions, FlowNode, HandleKind, HandleSide, NodeData, PropertyValue } from './FlowTypes';

/** Visual outline drawn behind a node's content. */
export type NodeShape = 'rounded' | 'pill' | 'diamond' | 'parallelogram' | 'rectangle' | 'subprocess';

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
  | 'subprocess';

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
    handles: [{ id: 'out', kind: 'source', side: 'bottom' }],
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
    handles: [{ id: 'in', kind: 'target', side: 'top' }],
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

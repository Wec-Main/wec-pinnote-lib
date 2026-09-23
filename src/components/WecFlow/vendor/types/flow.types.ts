export type FlowNodeType =
  | "start"
  | "end"
  | "process"
  | "decision"
  | "input"
  | "output";

export interface FlowPosition {
  x: number;
  y: number;
}

export interface FlowNodeData {
  label: string;
  description?: string;
  [key: string]: unknown;
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  position: FlowPosition;
  data: FlowNodeData;
}

export type FlowEdgeLineStyle = "solid" | "dashed";
export type FlowEdgeArrow = "none" | "forward" | "both";

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  lineStyle?: FlowEdgeLineStyle;
  arrow?: FlowEdgeArrow;
}

export interface FlowDefinition {
  id: string;
  name: string;
  description?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowValidationError {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface FlowValidationResult {
  valid: boolean;
  errors: FlowValidationError[];
}

export interface FlowBuilderProps {
  initialFlow?: FlowDefinition;
  value?: FlowDefinition;
  onChange?: (flow: FlowDefinition) => void;
  onNodeSelect?: (node: FlowNode | null) => void;
  onEdgeSelect?: (edge: FlowEdge | null) => void;
  readonly?: boolean;
  showNodePalette?: boolean;
  showPropertiesPanel?: boolean;
  showControls?: boolean;
  showMiniMap?: boolean;
  height?: string | number;
  className?: string;
}

export interface FlowBuilderRef {
  getFlow: () => FlowDefinition;
  setFlow: (flow: FlowDefinition) => void;
  clear: () => void;
  fitView: () => void;
  exportJSON: () => string;
}

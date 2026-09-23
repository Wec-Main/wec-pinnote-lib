import type { RichText } from "./richText.types";

export type { RichText, RichTextRun, RichTextAlign, RichTextTransform } from "./richText.types";

export type FlowNodeType =
  | "start"
  | "end"
  | "process"
  | "decision"
  | "input"
  | "output"
  | "rectangle"
  | "roundedRectangle"
  | "ellipse"
  | "diamond"
  | "parallelogram"
  | "triangle"
  | "hexagon"
  | "cylinder"
  | "cloud"
  | "document"
  | "text"
  | "container"
  | "actor"
  | "package"
  | "note";

export interface FlowPosition {
  x: number;
  y: number;
}

export type FlowEdgeLineStyle = "solid" | "dashed" | "dotted";

export interface FlowNodeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  lineStyle?: FlowEdgeLineStyle;
  opacity?: number;
  rotation?: number;
  perimeter?: number;
  shadow?: boolean;
  glow?: boolean;
  cornerRadius?: number;
}

export interface FlowNodeData {
  label: RichText;
  description?: string;
  groupId?: string;
  layerId?: string;
  style?: FlowNodeStyle;
  [key: string]: unknown;
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  position: FlowPosition;
  data: FlowNodeData;
  style?: FlowNodeStyle;
  locked?: boolean;
  layerId?: string;
  width?: number;
  height?: number;
}

export type FlowEdgeArrowShape = "triangle" | "open";
export type FlowEdgeArrow = "none" | "forward" | "both";
export type FlowEdgeRouting = "straight" | "orthogonal" | "curved";

export interface FlowEdgeWaypoint {
  x: number;
  y: number;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: RichText;
  lineStyle?: FlowEdgeLineStyle;
  arrow?: FlowEdgeArrow;
  arrowStart?: FlowEdgeArrow;
  arrowEnd?: FlowEdgeArrow;
  arrowStartShape?: FlowEdgeArrowShape;
  arrowEndShape?: FlowEdgeArrowShape;
  stroke?: string;
  strokeWidth?: number;
  layerId?: string;
  routing?: FlowEdgeRouting;
  waypoints?: FlowEdgeWaypoint[];
}

export interface FlowLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
}

export interface FlowPageGridSettings {
  enabled?: boolean;
  size?: number;
  snap?: boolean;
}

export interface FlowPageViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface FlowPage {
  id: string;
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  background?: string;
  gridSettings?: FlowPageGridSettings;
  viewport?: FlowPageViewport;
  layers?: FlowLayer[];
}

export interface FlowDefinition {
  id: string;
  name: string;
  description?: string;
  schemaVersion?: number;
  pages: FlowPage[];
  activePageId?: string;
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
  onZoomChange?: (zoom: number) => void;
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
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  deleteSelected: () => void;
  selectAll: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  getZoom: () => number;
  isGridVisible: () => boolean;
  setGridVisible: (visible: boolean) => void;
  bringToFront: (nodeId: string) => void;
  sendToBack: (nodeId: string) => void;
  bringSelectedToFront: () => void;
  sendSelectedToBack: () => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  alignSelected: (edge: FlowAlignEdge) => void;
  distributeSelected: (axis: FlowAxis) => void;
  rotateSelected: (degrees: number) => void;
  flipSelected: (axis: FlowAxis) => void;
  lockSelected: () => void;
  unlockSelected: () => void;
  hasSelection: () => boolean;
  isSelectionLocked: () => boolean;
  getActivePageId: () => string;
  setActivePageId: (pageId: string) => void;
  addPage: () => void;
  isOutlineVisible: () => boolean;
  setOutlineVisible: (visible: boolean) => void;
  isRulersVisible: () => boolean;
  setRulersVisible: (visible: boolean) => void;
  isFullscreen: () => boolean;
  toggleFullscreen: () => void;
  exportSVG: () => string;
  exportPNG: () => Promise<Blob>;
}

export type FlowAlignEdge = "left" | "center" | "right" | "top" | "middle" | "bottom";
export type FlowAxis = "horizontal" | "vertical";

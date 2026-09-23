import './styles/theme.css';

// ------------------------------------------------------------- components
export { FlowEditor, type FlowEditorProps } from './components/FlowEditor/FlowEditor';
export { FlowProvider, type FlowProviderProps } from './components/FlowProvider';
export { FlowCanvas, type FlowCanvasProps } from './components/FlowCanvas/FlowCanvas';
export { MiniMap } from './components/FlowCanvas/MiniMap';
export { Background, type BackgroundVariant } from './components/FlowCanvas/Background';
export { NodeRenderer, NodeItem } from './components/NodeRenderer/NodeRenderer';
export { DefaultNodeContent } from './components/NodeRenderer/DefaultNodeContent';
export { EdgeRenderer, EdgeLabelRenderer } from './components/EdgeRenderer/EdgeRenderer';
export { Sidebar, type SidebarProps } from './components/Sidebar/Sidebar';
export { PropertiesPanel, type PropertiesPanelProps } from './components/PropertiesPanel/PropertiesPanel';
export { Toolbar, type ToolbarProps, type NoticeKind } from './components/Toolbar/Toolbar';
export { ValidationPanel } from './components/ValidationPanel/ValidationPanel';
export { Icon, NodeIcon, type IconName } from './components/icons';

// ------------------------------------------------------------------ hooks
export { useFlowEngine, useFlowState, type FlowContextValue } from './hooks/FlowContext';
export { useNodes, useEdges, useViewport, useReadOnly, useSelection } from './hooks/useFlow';
export { useEdgeGeometry, type EdgeGeometry } from './hooks/useEdgeGeometry';

// ------------------------------------------------------------------- core
export {
  FlowEngine,
  createFlowEngine,
  type FlowEngineOptions,
  type FlowEngineEvents,
  type FlowOperation,
  type FlowState,
  type ConnectionState,
  type HandleRef,
  type NewNodeInput,
  type NodePatch,
} from './core/FlowEngine';
export { HistoryManager } from './core/HistoryManager';
export { Store } from './core/Store';
export { checkConnection, type ConnectionCheckResult, type ConnectionContext, type ConnectionValidator } from './core/ConnectionRules';
export {
  validateFlow,
  defaultValidationRules,
  startNodeRequired,
  endNodeRequired,
  disconnectedNodes,
  unreachableNodes,
  deadEnds,
  invalidConnections,
  decisionBranches,
  unknownNodeTypes,
  type ValidationIssue,
  type ValidationResult,
  type ValidationRule,
  type ValidationContext,
  type IssueSeverity,
} from './core/Validator';

// ----------------------------------------------------------------- models
export * from './models/FlowTypes';
export * from './models/NodeTypes';

// ------------------------------------------------------------------ utils
export { parseFlow, stringifyFlow, FlowParseError } from './utils/serialization';
export { getEdgePath, getBezierPath, getStraightPath, getStepPath, type EdgePath, type EdgePathInput } from './utils/edgePaths';
export { getNodeRect, getHandlePosition, getBounds, screenToFlow, flowToScreen } from './utils/geometry';
export { createId } from './utils/id';
export { NODE_DRAG_MIME } from './utils/constants';

import {
  FLOW_JSON_VERSION,
  type Connection,
  type Dimensions,
  type EdgePathType,
  type FlowEdge,
  type FlowJSON,
  type FlowNode,
  type FlowSnapshot,
  type HandleKind,
  type NodeData,
  type PropertyValue,
  type Rect,
  type Viewport,
  type XYPosition,
} from '../models/FlowTypes';
import { NodeTypeRegistry, builtInNodeTypes, type NodeTypeDefinition } from '../models/NodeTypes';
import {
  clamp,
  findHandle,
  getBounds,
  getHandlePosition,
  getNodeRect,
  pointInRect,
  rectsIntersect,
  screenToFlow,
  snapPosition,
} from '../utils/geometry';
import { alignRects, distributeRects, type AlignMode, type AlignmentGuide, type DistributeAxis } from '../utils/alignment';
import { createId } from '../utils/id';
import { checkConnection, type ConnectionCheckResult, type ConnectionValidator } from './ConnectionRules';
import { EventEmitter } from './EventEmitter';
import { HistoryManager } from './HistoryManager';
import { Store } from './Store';
import { defaultValidationRules, validateFlow, type IssueSeverity, type ValidationResult, type ValidationRule } from './Validator';

export interface HandleRef {
  nodeId: string;
  handleId: string;
}

/** Transient state while the user drags a new connection. */
export interface ConnectionState {
  from: HandleRef & { kind: HandleKind };
  /** Pointer position in flow coordinates. */
  pointer: XYPosition;
  /** Handle the connection would snap to on release. */
  candidate: HandleRef | null;
  valid: boolean;
  reason?: string;
}

export interface FlowState {
  nodes: FlowNode[];
  edges: FlowEdge[];
  nodeLookup: ReadonlyMap<string, FlowNode>;
  edgeLookup: ReadonlyMap<string, FlowEdge>;
  selectedNodeIds: ReadonlySet<string>;
  selectedEdgeIds: ReadonlySet<string>;
  viewport: Viewport;
  canvasSize: Dimensions;
  readOnly: boolean;
  defaultEdgeType: EdgePathType;
  snapToGrid: boolean;
  gridSize: number;
  connection: ConnectionState | null;
  /** Rubber-band selection rectangle in flow coordinates. */
  selectionRect: Rect | null;
  guides: AlignmentGuide[];
  validation: ValidationResult | null;
  issueNodeIds: ReadonlyMap<string, IssueSeverity>;
  issueEdgeIds: ReadonlyMap<string, IssueSeverity>;
  canUndo: boolean;
  canRedo: boolean;
  flowName: string;
  /** Bumped when node type definitions change so renderers refresh. */
  registryVersion: number;
}

/** Serializable description of every mutation; the hook point for collaboration / persistence. */
export type FlowOperation =
  | { type: 'addNode'; node: FlowNode }
  | { type: 'updateNode'; node: FlowNode }
  | { type: 'moveNodes'; positions: Record<string, XYPosition> }
  | { type: 'removeNodes'; ids: string[]; edgeIds: string[] }
  | { type: 'addEdge'; edge: FlowEdge }
  | { type: 'updateEdge'; edge: FlowEdge }
  | { type: 'removeEdges'; ids: string[] }
  | { type: 'load'; flow: FlowSnapshot }
  | { type: 'undo' }
  | { type: 'redo' };

export interface FlowEngineEvents extends Record<string, unknown> {
  change: FlowSnapshot;
  operation: FlowOperation;
  selectionChange: { nodeIds: string[]; edgeIds: string[] };
  viewportChange: Viewport;
}

export interface FlowEngineOptions {
  /** Additional node types, or overrides of built-in ones (matched by `type`). */
  nodeTypes?: NodeTypeDefinition[];
  /** Set to false to start from an empty registry instead of the built-in node types. */
  includeBuiltInNodeTypes?: boolean;
  initialFlow?: Partial<FlowJSON>;
  readOnly?: boolean;
  defaultEdgeType?: EdgePathType;
  snapToGrid?: boolean;
  gridSize?: number;
  historyLimit?: number;
  minZoom?: number;
  maxZoom?: number;
  /** Extra rule applied after the built-in connection checks. */
  isValidConnection?: ConnectionValidator;
  validationRules?: ValidationRule[];
}

export interface NewNodeInput {
  type: string;
  position: XYPosition;
  id?: string;
  width?: number;
  height?: number;
  data?: Partial<NodeData>;
  parentId?: string;
}

export type NodePatch = Partial<Omit<FlowNode, 'id' | 'data'>> & { data?: Partial<NodeData> };

const EMPTY_SET: ReadonlySet<string> = new Set();
const EMPTY_MAP: ReadonlyMap<string, IssueSeverity> = new Map();
/** Screen-space radius (px) in which a dragged connection snaps to a handle. */
const CONNECT_RADIUS = 28;

const isEdgePathType = (value: unknown): value is EdgePathType => value === 'bezier' || value === 'straight' || value === 'step';

function savedEdgeType(meta: FlowJSON['meta']): EdgePathType | undefined {
  const value = meta?.edgeType;
  return isEdgePathType(value) ? value : undefined;
}

/**
 * Framework-agnostic flow state engine. All business logic (mutations,
 * history, selection, viewport math, connection rules, validation) lives here;
 * React components only read state and call these methods.
 */
export class FlowEngine {
  readonly store: Store<FlowState>;
  readonly registry: NodeTypeRegistry;
  readonly history: HistoryManager<FlowSnapshot>;
  private readonly events = new EventEmitter<FlowEngineEvents>();
  private readonly options: FlowEngineOptions;
  private readonly minZoom: number;
  private readonly maxZoom: number;
  private interactionDepth = 0;
  private interactionStart: FlowSnapshot | null = null;
  private pendingFitView = false;
  private clipboard: FlowSnapshot | null = null;
  private pasteCount = 0;

  constructor(options: FlowEngineOptions = {}) {
    this.options = options;
    this.registry = new NodeTypeRegistry(options.includeBuiltInNodeTypes === false ? [] : builtInNodeTypes);
    options.nodeTypes?.forEach((d) => this.registry.register(d));
    this.history = new HistoryManager(options.historyLimit ?? 100);
    this.minZoom = options.minZoom ?? 0.1;
    this.maxZoom = options.maxZoom ?? 2.5;

    const initial = options.initialFlow ?? {};
    const nodes = (initial.nodes ?? []).map((n) => this.normalizeNode(n));
    const edges = initial.edges ?? [];
    this.store = new Store<FlowState>({
      nodes,
      edges,
      nodeLookup: new Map(nodes.map((n) => [n.id, n])),
      edgeLookup: new Map(edges.map((e) => [e.id, e])),
      selectedNodeIds: EMPTY_SET,
      selectedEdgeIds: EMPTY_SET,
      viewport: initial.viewport ?? { x: 0, y: 0, zoom: 1 },
      canvasSize: { width: 0, height: 0 },
      readOnly: options.readOnly ?? false,
      defaultEdgeType: savedEdgeType(initial.meta) ?? options.defaultEdgeType ?? 'bezier',
      snapToGrid: options.snapToGrid ?? false,
      gridSize: options.gridSize ?? 20,
      connection: null,
      selectionRect: null,
      guides: [],
      validation: null,
      issueNodeIds: EMPTY_MAP,
      issueEdgeIds: EMPTY_MAP,
      canUndo: false,
      canRedo: false,
      flowName: initial.meta?.name ?? 'Untitled flow',
      registryVersion: 0,
    });
    this.pendingFitView = !initial.viewport && nodes.length > 0;

    // Emit high-level change events whenever the graph or selection changes.
    let prev = this.store.getState();
    this.store.subscribe(() => {
      const s = this.store.getState();
      if (s.nodes !== prev.nodes || s.edges !== prev.edges) this.events.emit('change', { nodes: s.nodes, edges: s.edges });
      if (s.selectedNodeIds !== prev.selectedNodeIds || s.selectedEdgeIds !== prev.selectedEdgeIds) {
        this.events.emit('selectionChange', { nodeIds: [...s.selectedNodeIds], edgeIds: [...s.selectedEdgeIds] });
      }
      if (s.viewport !== prev.viewport) this.events.emit('viewportChange', s.viewport);
      prev = s;
    });
  }

  // ---------------------------------------------------------------- queries

  getState = (): FlowState => this.store.getState();
  getNodes = (): FlowNode[] => this.getState().nodes;
  getEdges = (): FlowEdge[] => this.getState().edges;
  getNode = (id: string): FlowNode | undefined => this.getState().nodeLookup.get(id);
  getEdge = (id: string): FlowEdge | undefined => this.getState().edgeLookup.get(id);
  getSnapshot = (): FlowSnapshot => ({ nodes: this.getState().nodes, edges: this.getState().edges });
  getDefinition = (type: string): NodeTypeDefinition => this.registry.get(type);
  getNodeRect = (node: FlowNode): Rect => getNodeRect(node, this.registry);

  on<K extends keyof FlowEngineEvents>(event: K, handler: (payload: FlowEngineEvents[K]) => void): () => void {
    return this.events.on(event, handler);
  }

  // -------------------------------------------------------------- internals

  private normalizeNode(input: NewNodeInput | FlowNode): FlowNode {
    const def = this.registry.get(input.type);
    const defaults: Record<string, PropertyValue> = {};
    def.propertySchema?.forEach((f) => {
      if (f.defaultValue !== undefined) defaults[f.key] = f.defaultValue;
    });
    const data = input.data ?? {};
    const node: FlowNode = {
      id: input.id ?? createId(input.type),
      type: input.type,
      position: { ...input.position },
      data: {
        ...def.defaultData,
        ...data,
        label: data.label ?? def.defaultData?.label ?? def.label,
        description: data.description ?? def.defaultData?.description ?? '',
        properties: { ...defaults, ...def.defaultData?.properties, ...data.properties },
      },
    };
    if (input.width !== undefined) node.width = input.width;
    if (input.height !== undefined) node.height = input.height;
    if (input.parentId !== undefined) node.parentId = input.parentId;
    return node;
  }

  /** Replaces the graph, keeping derived state (lookup, selection, history flags) consistent. */
  private setGraph(nodes: FlowNode[], edges: FlowEdge[]): void {
    const s = this.getState();
    const nodeLookup = nodes === s.nodes ? s.nodeLookup : new Map(nodes.map((n) => [n.id, n]));
    const edgeLookup = edges === s.edges ? s.edgeLookup : new Map(edges.map((e) => [e.id, e]));
    let { selectedNodeIds, selectedEdgeIds } = s;
    if ([...selectedNodeIds].some((id) => !nodeLookup.has(id))) {
      selectedNodeIds = new Set([...selectedNodeIds].filter((id) => nodeLookup.has(id)));
    }
    if ([...selectedEdgeIds].some((id) => !edgeLookup.has(id))) {
      selectedEdgeIds = new Set([...selectedEdgeIds].filter((id) => edgeLookup.has(id)));
    }
    this.store.setState({
      nodes,
      edges,
      nodeLookup,
      edgeLookup,
      selectedNodeIds,
      selectedEdgeIds,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
    });
  }

  /** Applies a recorded mutation: pushes history (unless inside an interaction) and emits the operation. */
  private commit(nodes: FlowNode[], edges: FlowEdge[], op: FlowOperation): void {
    const s = this.getState();
    if (nodes === s.nodes && edges === s.edges) return;
    if (this.interactionDepth === 0) this.history.push({ nodes: s.nodes, edges: s.edges });
    this.setGraph(nodes, edges);
    this.events.emit('operation', op);
  }

  /**
   * Groups every mutation until the matching `endInteraction()` into a single
   * undo step (used for drags, resizes and text editing).
   */
  beginInteraction(): void {
    if (this.interactionDepth++ === 0) this.interactionStart = this.getSnapshot();
  }

  endInteraction(): void {
    if (this.interactionDepth === 0) return;
    if (--this.interactionDepth > 0) return;
    const start = this.interactionStart;
    this.interactionStart = null;
    const s = this.getState();
    if (start && (start.nodes !== s.nodes || start.edges !== s.edges)) {
      this.history.push(start);
      this.store.setState({ canUndo: this.history.canUndo, canRedo: this.history.canRedo });
    }
  }

  // ------------------------------------------------------------- node API

  addNode(input: NewNodeInput): FlowNode {
    const node = this.normalizeNode(input);
    if (this.getState().nodeLookup.has(node.id)) throw new Error(`Node id "${node.id}" already exists`);
    const s = this.getState();
    this.commit([...s.nodes, node], s.edges, { type: 'addNode', node });
    return node;
  }

  updateNode(id: string, patch: NodePatch | ((node: FlowNode) => FlowNode)): void {
    const s = this.getState();
    const current = s.nodeLookup.get(id);
    if (!current) return;
    const next =
      typeof patch === 'function'
        ? patch(current)
        : { ...current, ...patch, id, data: patch.data ? { ...current.data, ...patch.data } : current.data };
    this.commit(
      s.nodes.map((n) => (n.id === id ? next : n)),
      s.edges,
      { type: 'updateNode', node: next },
    );
  }

  updateNodeData(id: string, data: Partial<NodeData>): void {
    this.updateNode(id, { data });
  }

  setNodeProperty(id: string, key: string, value: PropertyValue): void {
    const node = this.getNode(id);
    if (node) this.updateNodeData(id, { properties: { ...node.data.properties, [key]: value } });
  }

  removeNodeProperty(id: string, key: string): void {
    const node = this.getNode(id);
    if (!node || !(key in node.data.properties)) return;
    const { [key]: _removed, ...rest } = node.data.properties;
    this.updateNodeData(id, { properties: rest });
  }

  /** Moves nodes to absolute positions (snapping is the caller's choice via `snap`). */
  setNodePositions(positions: Record<string, XYPosition>): void {
    const s = this.getState();
    let changed = false;
    const nodes = s.nodes.map((n) => {
      const p = positions[n.id];
      if (!p || (p.x === n.position.x && p.y === n.position.y)) return n;
      changed = true;
      return { ...n, position: p };
    });
    if (changed) this.commit(nodes, s.edges, { type: 'moveNodes', positions });
  }

  removeNodes(ids: string[]): void {
    const remove = new Set(ids);
    const s = this.getState();
    const removedEdges = s.edges.filter((e) => remove.has(e.source) || remove.has(e.target));
    this.commit(
      s.nodes.filter((n) => !remove.has(n.id)),
      removedEdges.length ? s.edges.filter((e) => !removedEdges.includes(e)) : s.edges,
      { type: 'removeNodes', ids, edgeIds: removedEdges.map((e) => e.id) },
    );
  }

  /** Copies nodes (and the edges between them) with an offset; selects the copies. */
  duplicateNodes(ids: string[], offset: XYPosition = { x: 40, y: 40 }): FlowNode[] {
    return this.insertCopies(this.subgraph(ids), offset);
  }

  copySelection(): boolean {
    const snapshot = this.subgraph([...this.getState().selectedNodeIds]);
    if (snapshot.nodes.length === 0) return false;
    this.clipboard = snapshot;
    this.pasteCount = 0;
    return true;
  }

  cutSelection(): boolean {
    if (!this.copySelection()) return false;
    this.deleteSelection();
    return true;
  }

  hasClipboard(): boolean {
    return this.clipboard !== null;
  }

  /** Pastes the clipboard, with its top-left at `at` (flow coordinates) or offset from the originals. */
  paste(at?: XYPosition): FlowNode[] {
    const clipboard = this.clipboard;
    if (!clipboard) return [];
    const bounds = getBounds(clipboard.nodes.map((n) => this.getNodeRect(n)));
    if (!bounds) return [];
    this.pasteCount += 1;
    const step = 40 * this.pasteCount;
    const offset = at ? this.snap({ x: at.x - bounds.x, y: at.y - bounds.y }) : { x: step, y: step };
    return this.insertCopies(clipboard, offset);
  }

  alignSelection(mode: AlignMode): void {
    const placed = this.selectedRects();
    const bounds = getBounds(placed.map((p) => p.rect));
    if (placed.length < 2 || !bounds) return;
    this.setNodePositions(alignRects(placed, bounds, mode));
  }

  distributeSelection(axis: DistributeAxis): void {
    const placed = this.selectedRects();
    const bounds = getBounds(placed.map((p) => p.rect));
    if (placed.length < 3 || !bounds) return;
    this.setNodePositions(distributeRects(placed, bounds, axis));
  }

  setGuides(guides: AlignmentGuide[]): void {
    if (guides.length === 0 && this.getState().guides.length === 0) return;
    this.store.setState({ guides });
  }

  private selectedRects() {
    const s = this.getState();
    return s.nodes.filter((n) => s.selectedNodeIds.has(n.id)).map((n) => ({ id: n.id, rect: this.getNodeRect(n) }));
  }

  private subgraph(ids: string[]): FlowSnapshot {
    const s = this.getState();
    const include = new Set(ids);
    return {
      nodes: s.nodes.filter((n) => include.has(n.id)),
      edges: s.edges.filter((e) => include.has(e.source) && include.has(e.target)),
    };
  }

  private insertCopies(source: FlowSnapshot, offset: XYPosition): FlowNode[] {
    const idMap = new Map<string, string>();
    const copies = source.nodes.map((n) => {
      const copy: FlowNode = {
        ...n,
        id: createId(n.type),
        position: { x: n.position.x + offset.x, y: n.position.y + offset.y },
        data: { ...n.data, properties: { ...n.data.properties } },
      };
      idMap.set(n.id, copy.id);
      return copy;
    });
    if (copies.length === 0) return [];
    const edgeCopies = source.edges.flatMap((e) => {
      const sourceId = idMap.get(e.source);
      const targetId = idMap.get(e.target);
      return sourceId && targetId ? [{ ...e, id: createId('edge'), source: sourceId, target: targetId }] : [];
    });
    this.beginInteraction();
    copies.forEach((node) => this.commit([...this.getNodes(), node], this.getEdges(), { type: 'addNode', node }));
    edgeCopies.forEach((edge) => this.commit(this.getNodes(), [...this.getEdges(), edge], { type: 'addEdge', edge }));
    this.endInteraction();
    this.setSelection(copies.map((n) => n.id), []);
    return copies;
  }

  // ------------------------------------------------------------- edge API

  /** Checks built-in rules and the optional custom validator. */
  canConnect(conn: Connection, ignoreEdgeId?: string): ConnectionCheckResult {
    const s = this.getState();
    const ctx = { nodeLookup: s.nodeLookup, edges: s.edges, registry: this.registry, ignoreEdgeId };
    const result = checkConnection(conn, ctx);
    if (!result.valid || !this.options.isValidConnection) return result;
    return this.options.isValidConnection(conn, ctx);
  }

  /** Creates an edge if the connection is valid. Returns null otherwise. */
  addEdge(conn: Connection, extra: Partial<Omit<FlowEdge, 'source' | 'target'>> = {}): FlowEdge | null {
    if (!this.canConnect(conn).valid) return null;
    const s = this.getState();
    const sourceDef = this.registry.get(s.nodeLookup.get(conn.source)!.type);
    const targetDef = this.registry.get(s.nodeLookup.get(conn.target)!.type);
    const sourceHandle = findHandle(sourceDef, 'source', conn.sourceHandle)!.id;
    const targetHandle = findHandle(targetDef, 'target', conn.targetHandle)!.id;
    const label = extra.label ?? sourceDef.defaultEdgeLabels?.[sourceHandle];
    const edge: FlowEdge = {
      ...extra,
      id: extra.id ?? createId('edge'),
      source: conn.source,
      target: conn.target,
      sourceHandle,
      targetHandle,
      ...(label ? { label } : {}),
    };
    this.commit(s.nodes, [...s.edges, edge], { type: 'addEdge', edge });
    return edge;
  }

  updateEdge(id: string, patch: Partial<Omit<FlowEdge, 'id'>>): void {
    const s = this.getState();
    const current = s.edgeLookup.get(id);
    if (!current) return;
    const edge = { ...current, ...patch };
    this.commit(s.nodes, s.edges.map((e) => (e.id === id ? edge : e)), { type: 'updateEdge', edge });
  }

  removeEdges(ids: string[]): void {
    const remove = new Set(ids);
    const s = this.getState();
    this.commit(s.nodes, s.edges.filter((e) => !remove.has(e.id)), { type: 'removeEdges', ids });
  }

  /** Deletes all selected nodes and edges as a single undo step. */
  deleteSelection(): void {
    const { selectedNodeIds, selectedEdgeIds } = this.getState();
    if (!selectedNodeIds.size && !selectedEdgeIds.size) return;
    this.beginInteraction();
    if (selectedEdgeIds.size) this.removeEdges([...selectedEdgeIds]);
    if (selectedNodeIds.size) this.removeNodes([...selectedNodeIds]);
    this.endInteraction();
  }

  // -------------------------------------------------------------- history

  undo(): void {
    if (this.interactionDepth > 0) return;
    const prev = this.history.undo(this.getSnapshot());
    if (!prev) return;
    this.setGraph(prev.nodes, prev.edges);
    this.events.emit('operation', { type: 'undo' });
  }

  redo(): void {
    if (this.interactionDepth > 0) return;
    const next = this.history.redo(this.getSnapshot());
    if (!next) return;
    this.setGraph(next.nodes, next.edges);
    this.events.emit('operation', { type: 'redo' });
  }

  // ------------------------------------------------------------ selection

  setSelection(nodeIds: Iterable<string>, edgeIds: Iterable<string> = []): void {
    this.store.setState({ selectedNodeIds: new Set(nodeIds), selectedEdgeIds: new Set(edgeIds) });
  }

  /** Selects a node. With `additive` the node is toggled within the current selection. */
  selectNode(id: string, additive = false): void {
    const s = this.getState();
    if (!additive) {
      if (s.selectedNodeIds.size === 1 && s.selectedNodeIds.has(id) && !s.selectedEdgeIds.size) return;
      return this.setSelection([id]);
    }
    const next = new Set(s.selectedNodeIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.store.setState({ selectedNodeIds: next });
  }

  selectEdge(id: string, additive = false): void {
    const s = this.getState();
    if (!additive) return this.setSelection([], [id]);
    const next = new Set(s.selectedEdgeIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.store.setState({ selectedEdgeIds: next });
  }

  clearSelection(): void {
    const s = this.getState();
    if (s.selectedNodeIds.size || s.selectedEdgeIds.size) this.setSelection([], []);
  }

  selectAll(): void {
    const s = this.getState();
    this.setSelection(s.nodes.map((n) => n.id), s.edges.map((e) => e.id));
  }

  /** Selects every node intersecting a flow-space rectangle. */
  selectInRect(rect: Rect, additive = false): void {
    const s = this.getState();
    const hits = s.nodes.filter((n) => rectsIntersect(rect, this.getNodeRect(n))).map((n) => n.id);
    this.setSelection(additive ? new Set([...s.selectedNodeIds, ...hits]) : hits, additive ? s.selectedEdgeIds : []);
  }

  setSelectionRect(rect: Rect | null): void {
    this.store.setState({ selectionRect: rect });
  }

  // ------------------------------------------------------------- viewport

  setViewport(v: Viewport): void {
    this.store.setState({ viewport: { x: v.x, y: v.y, zoom: clamp(v.zoom, this.minZoom, this.maxZoom) } });
  }

  panBy(dx: number, dy: number): void {
    const v = this.getState().viewport;
    this.setViewport({ ...v, x: v.x + dx, y: v.y + dy });
  }

  /** Zooms by `factor` keeping the given canvas-relative screen point fixed. */
  zoomAt(factor: number, point?: XYPosition): void {
    const { viewport: v, canvasSize } = this.getState();
    const p = point ?? { x: canvasSize.width / 2, y: canvasSize.height / 2 };
    const zoom = clamp(v.zoom * factor, this.minZoom, this.maxZoom);
    const k = zoom / v.zoom;
    this.setViewport({ zoom, x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k });
  }

  zoomTo(zoom: number): void {
    this.zoomAt(zoom / this.getState().viewport.zoom);
  }

  zoomIn = () => this.zoomAt(1.2);
  zoomOut = () => this.zoomAt(1 / 1.2);

  /** Fits the given nodes (default: all) into the canvas. */
  fitView(options: { padding?: number; nodeIds?: string[]; maxZoom?: number } = {}): void {
    const s = this.getState();
    if (!s.canvasSize.width || !s.canvasSize.height) {
      this.pendingFitView = true;
      return;
    }
    const ids = options.nodeIds ? new Set(options.nodeIds) : null;
    const bounds = getBounds(s.nodes.filter((n) => !ids || ids.has(n.id)).map((n) => this.getNodeRect(n)));
    if (!bounds) {
      this.setViewport({ x: s.canvasSize.width / 2, y: s.canvasSize.height / 3, zoom: 1 });
      return;
    }
    const padding = options.padding ?? 60;
    const zoom = clamp(
      Math.min((s.canvasSize.width - padding * 2) / bounds.width, (s.canvasSize.height - padding * 2) / bounds.height),
      this.minZoom,
      options.maxZoom ?? 1.25,
    );
    this.setViewport({
      zoom,
      x: s.canvasSize.width / 2 - (bounds.x + bounds.width / 2) * zoom,
      y: s.canvasSize.height / 2 - (bounds.y + bounds.height / 2) * zoom,
    });
  }

  /** Centers the viewport on a flow-space point. */
  centerOn(point: XYPosition, zoom = this.getState().viewport.zoom): void {
    const { canvasSize } = this.getState();
    this.setViewport({ zoom, x: canvasSize.width / 2 - point.x * zoom, y: canvasSize.height / 2 - point.y * zoom });
  }

  setCanvasSize(size: Dimensions): void {
    this.store.setState({ canvasSize: size });
    if (this.pendingFitView && size.width && size.height) {
      this.pendingFitView = false;
      this.fitView();
    }
  }

  /** Converts a canvas-relative screen point to flow coordinates. */
  screenToFlow = (p: XYPosition): XYPosition => screenToFlow(p, this.getState().viewport);

  /** Applies grid snapping when enabled. */
  snap = (p: XYPosition): XYPosition => {
    const s = this.getState();
    return s.snapToGrid ? snapPosition(p, s.gridSize) : p;
  };

  // ------------------------------------------------ interactive connections

  startConnection(from: HandleRef & { kind: HandleKind }, pointer: XYPosition): void {
    this.store.setState({ connection: { from, pointer, candidate: null, valid: false } });
  }

  private connectionFor(from: HandleRef & { kind: HandleKind }, to: HandleRef): Connection {
    return from.kind === 'source'
      ? { source: from.nodeId, sourceHandle: from.handleId, target: to.nodeId, targetHandle: to.handleId }
      : { source: to.nodeId, sourceHandle: to.handleId, target: from.nodeId, targetHandle: from.handleId };
  }

  /** Finds the handle a connection being dragged to `pointer` would attach to. */
  findConnectionCandidate(pointer: XYPosition): HandleRef | null {
    const s = this.getState();
    const conn = s.connection;
    if (!conn) return null;
    const wanted: HandleKind = conn.from.kind === 'source' ? 'target' : 'source';
    const radius = CONNECT_RADIUS / s.viewport.zoom;
    let best: HandleRef | null = null;
    let bestDist = Infinity;
    let hovered: FlowNode | null = null;
    for (const node of s.nodes) {
      if (node.id === conn.from.nodeId) continue;
      const rect = this.getNodeRect(node);
      const inside = pointInRect(pointer, rect);
      if (inside) hovered = node;
      // Cheap rejection before looking at individual handles.
      if (!inside && !rectsIntersect(rect, { x: pointer.x - radius, y: pointer.y - radius, width: radius * 2, height: radius * 2 })) continue;
      const def = this.registry.get(node.type);
      for (const h of def.handles) {
        if (h.kind !== wanted) continue;
        const p = getHandlePosition(node, def, h);
        const d = Math.hypot(p.x - pointer.x, p.y - pointer.y);
        if (d <= radius && d < bestDist) {
          bestDist = d;
          best = { nodeId: node.id, handleId: h.id };
        }
      }
    }
    if (best || !hovered) return best;
    // Dropped on a node body: pick its closest valid handle.
    const def = this.registry.get(hovered.type);
    const options = def.handles
      .filter((h) => h.kind === wanted)
      .map((h) => ({ h, p: getHandlePosition(hovered!, def, h) }))
      .filter(({ h }) => this.canConnect(this.connectionFor(conn.from, { nodeId: hovered!.id, handleId: h.id })).valid)
      .sort((a, b) => Math.hypot(a.p.x - pointer.x, a.p.y - pointer.y) - Math.hypot(b.p.x - pointer.x, b.p.y - pointer.y));
    const [closest] = options;
    return { nodeId: hovered.id, handleId: closest ? closest.h.id : '' };
  }

  updateConnection(pointer: XYPosition): void {
    const conn = this.getState().connection;
    if (!conn) return;
    const candidate = this.findConnectionCandidate(pointer);
    let valid = false;
    let reason: string | undefined;
    if (candidate) {
      if (candidate.handleId === '') {
        reason = 'No compatible handle on this node';
      } else {
        const result = this.canConnect(this.connectionFor(conn.from, candidate));
        valid = result.valid;
        reason = result.reason;
      }
    }
    this.store.setState({ connection: { ...conn, pointer, candidate: candidate?.handleId ? candidate : null, valid, reason } });
  }

  /** Completes the drag: creates the edge if the current candidate is valid. */
  endConnection(): FlowEdge | null {
    const conn = this.getState().connection;
    this.store.setState({ connection: null });
    if (!conn?.candidate || !conn.valid) return null;
    return this.addEdge(this.connectionFor(conn.from, conn.candidate));
  }

  cancelConnection(): void {
    this.store.setState({ connection: null });
  }

  // ----------------------------------------------------------- flow level

  /** Loads a flow, replacing the current one. By default history is reset. */
  loadFlow(flow: Partial<FlowJSON>, options: { recordHistory?: boolean } = {}): void {
    const nodes = (flow.nodes ?? []).map((n) => this.normalizeNode(n));
    const edges = flow.edges ?? [];
    if (options.recordHistory) {
      this.commit(nodes, edges, { type: 'load', flow: { nodes, edges } });
    } else {
      this.history.clear();
      this.setGraph(nodes, edges);
      this.events.emit('operation', { type: 'load', flow: { nodes, edges } });
    }
    this.store.setState({
      selectedNodeIds: EMPTY_SET,
      selectedEdgeIds: EMPTY_SET,
      validation: null,
      issueNodeIds: EMPTY_MAP,
      issueEdgeIds: EMPTY_MAP,
      flowName: flow.meta?.name ?? this.getState().flowName,
      defaultEdgeType: savedEdgeType(flow.meta) ?? this.getState().defaultEdgeType,
    });
    if (flow.viewport) this.setViewport(flow.viewport);
    else this.fitView();
  }

  /** Clears the canvas. Recorded in history so it can be undone. */
  newFlow(name = 'Untitled flow'): void {
    this.commit([], [], { type: 'load', flow: { nodes: [], edges: [] } });
    this.clearValidation();
    this.store.setState({ flowName: name, selectedNodeIds: EMPTY_SET, selectedEdgeIds: EMPTY_SET });
    const { canvasSize } = this.getState();
    this.setViewport({ x: canvasSize.width / 2, y: canvasSize.height / 3, zoom: 1 });
  }

  toJSON(): FlowJSON {
    const s = this.getState();
    return { version: FLOW_JSON_VERSION, nodes: s.nodes, edges: s.edges, viewport: s.viewport, meta: { name: s.flowName, edgeType: s.defaultEdgeType } };
  }

  setFlowName(name: string): void {
    this.store.setState({ flowName: name });
    this.events.emit('change', this.getSnapshot());
  }

  // ----------------------------------------------------------- validation

  validate(rules: ValidationRule[] = this.options.validationRules ?? defaultValidationRules): ValidationResult {
    const result = validateFlow(this.getSnapshot(), this.registry, rules);
    const issueNodeIds = new Map<string, IssueSeverity>();
    const issueEdgeIds = new Map<string, IssueSeverity>();
    for (const issue of result.issues) {
      for (const id of issue.nodeIds ?? []) if (issueNodeIds.get(id) !== 'error') issueNodeIds.set(id, issue.severity);
      for (const id of issue.edgeIds ?? []) if (issueEdgeIds.get(id) !== 'error') issueEdgeIds.set(id, issue.severity);
    }
    this.store.setState({ validation: result, issueNodeIds, issueEdgeIds });
    return result;
  }

  clearValidation(): void {
    this.store.setState({ validation: null, issueNodeIds: EMPTY_MAP, issueEdgeIds: EMPTY_MAP });
  }

  // -------------------------------------------------------------- settings

  setReadOnly(readOnly: boolean): void {
    this.store.setState({ readOnly, connection: null });
  }

  setDefaultEdgeType(type: EdgePathType): void {
    if (this.getState().defaultEdgeType === type) return;
    this.store.setState({ defaultEdgeType: type });
    this.events.emit('change', this.getSnapshot());
  }

  setSnapToGrid(snapToGrid: boolean): void {
    this.store.setState({ snapToGrid });
  }

  /** Registers a node type at runtime (plugin hook). */
  registerNodeType(definition: NodeTypeDefinition): void {
    this.registry.register(definition);
    this.store.setState({ registryVersion: this.getState().registryVersion + 1 });
  }
}

export function createFlowEngine(options?: FlowEngineOptions): FlowEngine {
  return new FlowEngine(options);
}

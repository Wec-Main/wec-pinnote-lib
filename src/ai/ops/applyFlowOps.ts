import type {
  FlowEdge,
  FlowJSON,
  FlowNode,
  HandleSide,
  PropertyValue,
  Rect,
  XYPosition,
} from "../../types/flowchart.types";
import { checkConnection } from "../../utils/flowchart/connectionRules";
import { findHandle, getNodeRect } from "../../utils/flowchart/geometry";
import { createId } from "../../utils/flowchart/id";
import {
  NodeTypeRegistry,
  builtInNodeTypes,
  isLaneShape,
  type NodeTypeDefinition,
} from "../../utils/flowchart/nodeTypes";
import { parseFlow } from "../../utils/flowchart/serialization";
import { validateFlow } from "../../utils/flowchart/validator";
import { diffFlow } from "./diff";
import { AI_FLOW_LIMITS, FLOW_NODE_GAP } from "./limits";
import { avoidOverlap, rightMost } from "./placement";
import { IdFactory, TempIds, cloneJson, resolveRef, type RefCandidate, type RefKind } from "./refs";
import type {
  ApplyFlowOpsOptions,
  ApplyOpsResult,
  FlowOp,
  FlowOpName,
  FlowPlacement,
  OpError,
  OpErrorCode,
  OpRef,
} from "./types";

const LAYOUT_GAP_MAIN = 100;
const LAYOUT_GAP_CROSS = 60;
const LAYOUT_BAND_GAP = 110;
const LAYOUT_TARGET_ASPECT = 1.8;
const LAYOUT_MIN_BAND_MAIN = 1400;
const LAYOUT_MAX_BAND_MAIN = 2600;
const AUTO_LAYOUT_MIN_ADDED = 3;
const AUTO_LAYOUT_MAX_EXISTING = 2;
const HANDLE_ORDER: readonly string[] = ["yes", "no"];
const DECISION_TYPE = "decision";
const DECISION_HANDLES: readonly string[] = ["yes", "no"];

interface Context {
  doc: FlowJSON;
  registry: NodeTypeRegistry;
  temps: TempIds;
  ids: IdFactory;
  lastAddedId: string | null;
  autoHandleEdges: Set<string>;
  laidOut: boolean;
  beforePositions: ReadonlyMap<string, XYPosition>;
  skipped: string[];
  laneOf: Map<string, string>;
  laneAdded: boolean;
}

interface Run {
  fail: (code: OpErrorCode, message: string) => void;
  failed: () => boolean;
}

type Handler<N extends FlowOpName> = (
  op: Extract<FlowOp, { op: N }>,
  ctx: Context,
  run: Run,
) => void;

const nodeCandidates = (ctx: Context): RefCandidate[] =>
  ctx.doc.nodes.map((node) => ({ id: node.id, name: node.data.label }));
const edgeCandidates = (ctx: Context): RefCandidate[] =>
  ctx.doc.edges.map((edge) => ({ id: edge.id, name: edge.label }));

function resolve(ctx: Context, run: Run, kind: RefKind, ref: OpRef, pool: RefCandidate[]) {
  const result = resolveRef(ref, kind, pool, ctx.temps);
  if (result.ok) return result.id;
  run.fail(result.code, result.message);
  return null;
}

function claimTemp(ctx: Context, run: Run, tempId: string | undefined): void {
  if (tempId === undefined) return;
  const key = tempId.trim().startsWith("$") ? tempId.trim() : `$${tempId.trim()}`;
  if (key === "$") run.fail("invalid_value", "tempId must not be empty");
  else if (ctx.temps.has(key))
    run.fail("duplicate_temp_id", `Temp id ${key} is declared more than once`);
}

function checkType(ctx: Context, run: Run, type: string): void {
  if (!ctx.registry.has(type)) {
    const known = ctx.registry
      .list()
      .map((def) => def.type)
      .join(", ");
    run.fail("invalid_value", `Unknown node type "${type}". Known types: ${known}`);
  }
}

function getNode(ctx: Context, id: string): FlowNode {
  return ctx.doc.nodes.find((node) => node.id === id) as FlowNode;
}

const rectOf = (ctx: Context, node: FlowNode): Rect => getNodeRect(node, ctx.registry);

function buildNode(
  ctx: Context,
  input: {
    type: string;
    label: string;
    description?: string;
    properties?: Record<string, PropertyValue>;
  },
  position: XYPosition,
): FlowNode {
  const def = ctx.registry.get(input.type);
  const defaults: Record<string, PropertyValue> = {};
  def.propertySchema?.forEach((field) => {
    if (field.defaultValue !== undefined) defaults[field.key] = field.defaultValue;
  });
  return {
    id: ctx.ids.next(input.type),
    type: input.type,
    position: { ...position },
    data: {
      ...def.defaultData,
      label: input.label,
      description: input.description ?? def.defaultData?.description ?? "",
      properties: { ...defaults, ...def.defaultData?.properties, ...input.properties },
    },
  };
}

function obstacles(ctx: Context): Rect[] {
  return ctx.doc.nodes
    .filter((node) => !isLaneShape(ctx.registry.get(node.type).shape))
    .map((node) => rectOf(ctx, node));
}

function placeNode(
  ctx: Context,
  type: string,
  nearId: string | null,
  placement: FlowPlacement,
): XYPosition {
  const { width, height } = ctx.registry.get(type).defaultSize;
  const anchorNode = nearId
    ? getNode(ctx, nearId)
    : ctx.lastAddedId
      ? ctx.doc.nodes.find((node) => node.id === ctx.lastAddedId)
      : undefined;
  const anchor = anchorNode ? rectOf(ctx, anchorNode) : rightMost(obstacles(ctx));
  const side = anchorNode ? placement : "right";
  if (!anchor) return { x: 0, y: 0 };
  const gap = FLOW_NODE_GAP;
  const starts: Record<FlowPlacement, XYPosition> = {
    right: { x: anchor.x + anchor.width + gap, y: anchor.y + anchor.height / 2 - height / 2 },
    left: { x: anchor.x - gap - width, y: anchor.y + anchor.height / 2 - height / 2 },
    below: { x: anchor.x + anchor.width / 2 - width / 2, y: anchor.y + anchor.height + gap },
    above: { x: anchor.x + anchor.width / 2 - width / 2, y: anchor.y - gap - height },
  };
  const axis = side === "right" || side === "left" ? "y" : "x";
  return avoidOverlap(starts[side], { width, height }, obstacles(ctx), gap / 2, axis);
}

function sideToward(from: Rect, to: Rect): HandleSide {
  const dx = to.x + to.width / 2 - (from.x + from.width / 2);
  const dy = to.y + to.height / 2 - (from.y + from.height / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
}

const OPPOSITE: Record<HandleSide, HandleSide> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

function handleOnSide(def: NodeTypeDefinition, kind: "source" | "target", side: HandleSide) {
  const handles = def.handles.filter((handle) => handle.kind === kind && !handle.label);
  return (handles.find((handle) => handle.side === side) ?? handles[0])?.id;
}

function pickHandles(
  ctx: Context,
  source: FlowNode,
  target: FlowNode,
  sourceHandle: string | undefined,
  targetHandle: string | undefined,
): { sourceHandle: string | undefined; targetHandle: string | undefined } {
  const side = sideToward(rectOf(ctx, source), rectOf(ctx, target));
  return {
    sourceHandle: sourceHandle ?? handleOnSide(ctx.registry.get(source.type), "source", side),
    targetHandle:
      targetHandle ?? handleOnSide(ctx.registry.get(target.type), "target", OPPOSITE[side]),
  };
}

const NO_LABEL = /^\s*(no|false|fail|failed|invalid|reject|rejected|deny|denied|n)\b/i;
const YES_LABEL = /^\s*(yes|true|ok|pass|passed|valid|approve|approved|allow|y)\b/i;

function decisionHandle(
  ctx: Context,
  sourceId: string,
  op: { sourceHandle?: string; label?: string },
): string {
  const given = op.sourceHandle?.trim().toLowerCase();
  if (given && DECISION_HANDLES.includes(given)) return given;
  const label = op.label ?? "";
  if (NO_LABEL.test(label)) return "no";
  if (YES_LABEL.test(label)) return "yes";
  const used = new Set(
    ctx.doc.edges.filter((edge) => edge.source === sourceId).map((edge) => edge.sourceHandle),
  );
  return DECISION_HANDLES.find((handle) => !used.has(handle)) ?? "no";
}

function connectionError(
  ctx: Context,
  edge: { source: string; target: string; sourceHandle?: string; targetHandle?: string },
  ignoreEdgeId?: string,
): string | null {
  const source = ctx.doc.nodes.find((node) => node.id === edge.source);
  if (
    source?.type === DECISION_TYPE &&
    (!edge.sourceHandle || !DECISION_HANDLES.includes(edge.sourceHandle))
  ) {
    return `Edges leaving decision "${source.data.label}" need sourceHandle "yes" or "no"`;
  }
  const result = checkConnection(edge, {
    nodeLookup: new Map(ctx.doc.nodes.map((node) => [node.id, node])),
    edges: ctx.doc.edges,
    registry: ctx.registry,
    ignoreEdgeId,
  });
  return result.valid ? null : (result.reason ?? "Invalid connection");
}

function buildEdge(
  ctx: Context,
  source: FlowNode,
  target: FlowNode,
  sourceHandle: string,
  targetHandle: string,
  extra: Partial<Omit<FlowEdge, "id" | "source" | "target">>,
): FlowEdge {
  const sourceDef = ctx.registry.get(source.type);
  const realSource = findHandle(sourceDef, "source", sourceHandle)?.id ?? sourceHandle;
  const realTarget =
    findHandle(ctx.registry.get(target.type), "target", targetHandle)?.id ?? targetHandle;
  const label = extra.label ?? sourceDef.defaultEdgeLabels?.[realSource];
  const edge: FlowEdge = {
    id: ctx.ids.next("edge"),
    source: source.id,
    target: target.id,
    sourceHandle: realSource,
    targetHandle: realTarget,
  };
  edge.type = extra.type ?? "step";
  if (extra.animated !== undefined) edge.animated = extra.animated;
  if (label) edge.label = label;
  return edge;
}

const HANDLERS: { [N in FlowOpName]: Handler<N> } = {
  addNode(op, ctx, run) {
    checkType(ctx, run, op.type);
    claimTemp(ctx, run, op.tempId);
    if (!op.label.trim()) run.fail("invalid_value", "label must not be empty");
    const nearId = op.near ? resolve(ctx, run, "node", op.near, nodeCandidates(ctx)) : null;
    if (run.failed()) return;
    const position = placeNode(ctx, op.type, nearId, op.placement ?? "right");
    const node = buildNode(ctx, op, position);
    ctx.doc.nodes.push(node);
    ctx.lastAddedId = node.id;
    if (isLaneNode(ctx, node)) {
      ctx.laneAdded = true;
    } else if (op.lane !== undefined) {
      const lane = findLane(ctx, op.lane);
      if (lane) ctx.laneOf.set(node.id, lane.id);
      else ctx.skipped.push(`Ignored lane "${op.lane}" for "${op.label}": no such swimlane`);
    }
    if (op.tempId !== undefined) ctx.temps.declare(op.tempId, "node", node.id);
  },

  updateNode(op, ctx, run) {
    const id = resolve(ctx, run, "node", op.node, nodeCandidates(ctx));
    if (!id) return;
    const { patch } = op;
    if (patch.type !== undefined) checkType(ctx, run, patch.type);
    if (patch.label !== undefined && !patch.label.trim()) {
      run.fail("invalid_value", "label must not be empty");
    }
    if (run.failed()) return;
    const current = getNode(ctx, id);
    const properties = { ...current.data.properties };
    for (const [key, value] of Object.entries(patch.properties ?? {})) {
      if (value === null) delete properties[key];
      else properties[key] = value;
    }
    const next: FlowNode = {
      ...current,
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      data: {
        ...current.data,
        ...(patch.label !== undefined ? { label: patch.label } : {}),
        ...(patch.description !== undefined ? { description: patch.description ?? "" } : {}),
        properties,
      },
    };
    if (patch.type !== undefined && patch.type !== current.type) {
      const nodes = ctx.doc.nodes;
      ctx.doc.nodes = nodes.map((node) => (node.id === id ? next : node));
      for (const edge of ctx.doc.edges.filter((e) => e.source === id || e.target === id)) {
        const problem = connectionError(ctx, edge, edge.id);
        if (problem) run.fail("invalid_connection", `Edge ${edge.id}: ${problem}`);
      }
      if (run.failed()) ctx.doc.nodes = nodes;
      return;
    }
    ctx.doc.nodes = ctx.doc.nodes.map((node) => (node.id === id ? next : node));
  },

  removeNode(op, ctx, run) {
    const id = resolve(ctx, run, "node", op.node, nodeCandidates(ctx));
    if (!id) return;
    ctx.doc.nodes = ctx.doc.nodes.filter((node) => node.id !== id);
    ctx.doc.edges = ctx.doc.edges.filter((edge) => edge.source !== id && edge.target !== id);
    if (ctx.lastAddedId === id) ctx.lastAddedId = null;
  },

  addEdge(op, ctx, run) {
    const sourceId = resolve(ctx, run, "node", op.source, nodeCandidates(ctx));
    const targetId = resolve(ctx, run, "node", op.target, nodeCandidates(ctx));
    claimTemp(ctx, run, op.tempId);
    if (!sourceId || !targetId || run.failed()) return;
    const source = getNode(ctx, sourceId);
    const target = getNode(ctx, targetId);
    const sourceHandle =
      source.type === DECISION_TYPE ? decisionHandle(ctx, sourceId, op) : op.sourceHandle;
    const handles = pickHandles(ctx, source, target, sourceHandle, op.targetHandle);
    const problem = connectionError(ctx, {
      source: sourceId,
      target: targetId,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
    });
    if (problem) {
      if (op.tempId !== undefined) run.fail("invalid_connection", problem);
      else
        ctx.skipped.push(
          `Skipped edge "${source.data.label}" -> "${target.data.label}": ${problem}`,
        );
      return;
    }
    const edge = buildEdge(
      ctx,
      source,
      target,
      handles.sourceHandle as string,
      handles.targetHandle as string,
      {
        ...(op.label !== undefined ? { label: op.label } : {}),
        ...(op.type ? { type: op.type } : {}),
      },
    );
    ctx.doc.edges.push(edge);
    if (op.sourceHandle === undefined || op.targetHandle === undefined) {
      ctx.autoHandleEdges.add(edge.id);
    }
    if (op.tempId !== undefined) ctx.temps.declare(op.tempId, "edge", edge.id);
  },

  updateEdge(op, ctx, run) {
    const id = resolve(ctx, run, "edge", op.edge, edgeCandidates(ctx));
    if (!id) return;
    ctx.doc.edges = ctx.doc.edges.map((edge) => {
      if (edge.id !== id) return edge;
      const next: FlowEdge = { ...edge };
      if (op.patch.label === null) delete next.label;
      else if (op.patch.label !== undefined) next.label = op.patch.label;
      if (op.patch.type !== undefined) next.type = op.patch.type;
      if (op.patch.animated !== undefined) next.animated = op.patch.animated;
      return next;
    });
  },

  removeEdge(op, ctx, run) {
    const id = resolve(ctx, run, "edge", op.edge, edgeCandidates(ctx));
    if (!id) return;
    ctx.doc.edges = ctx.doc.edges.filter((edge) => edge.id !== id);
  },

  insertNodeOnEdge(op, ctx, run) {
    const edgeId = resolve(ctx, run, "edge", op.edge, edgeCandidates(ctx));
    checkType(ctx, run, op.type);
    claimTemp(ctx, run, op.tempId);
    if (!op.label.trim()) run.fail("invalid_value", "label must not be empty");
    if (!edgeId || run.failed()) return;
    const edge = ctx.doc.edges.find((item) => item.id === edgeId) as FlowEdge;
    const source = getNode(ctx, edge.source);
    const target = getNode(ctx, edge.target);
    const a = rectOf(ctx, source);
    const b = rectOf(ctx, target);
    const def = ctx.registry.get(op.type);
    const center = {
      x: (a.x + a.width / 2 + b.x + b.width / 2) / 2,
      y: (a.y + a.height / 2 + b.y + b.height / 2) / 2,
    };
    const node = buildNode(ctx, op, {
      x: center.x - def.defaultSize.width / 2,
      y: center.y - def.defaultSize.height / 2,
    });
    const savedNodes = ctx.doc.nodes;
    const savedEdges = ctx.doc.edges;
    ctx.doc.nodes = [...savedNodes, node];
    ctx.doc.edges = savedEdges.filter((item) => item.id !== edgeId);
    const firstHandles = pickHandles(ctx, source, node, edge.sourceHandle, undefined);
    const secondHandles = pickHandles(
      ctx,
      node,
      target,
      op.type === DECISION_TYPE ? "yes" : undefined,
      edge.targetHandle,
    );
    const firstProblem = connectionError(ctx, {
      source: source.id,
      target: node.id,
      ...firstHandles,
    });
    const first = firstProblem
      ? null
      : buildEdge(
          ctx,
          source,
          node,
          firstHandles.sourceHandle as string,
          firstHandles.targetHandle as string,
          {
            ...(edge.type ? { type: edge.type } : {}),
            ...(edge.label !== undefined ? { label: edge.label } : {}),
            ...(edge.animated !== undefined ? { animated: edge.animated } : {}),
          },
        );
    if (first) ctx.doc.edges.push(first);
    const secondProblem = connectionError(ctx, {
      source: node.id,
      target: target.id,
      ...secondHandles,
    });
    if (firstProblem || secondProblem) {
      ctx.doc.nodes = savedNodes;
      ctx.doc.edges = savedEdges;
      run.fail("invalid_connection", (firstProblem ?? secondProblem) as string);
      return;
    }
    ctx.doc.edges.push(
      buildEdge(
        ctx,
        node,
        target,
        secondHandles.sourceHandle as string,
        secondHandles.targetHandle as string,
        {
          ...(edge.type ? { type: edge.type } : {}),
          ...(edge.animated !== undefined ? { animated: edge.animated } : {}),
        },
      ),
    );
    ctx.lastAddedId = node.id;
    if (op.tempId !== undefined) ctx.temps.declare(op.tempId, "node", node.id);
  },

  setFlowName(op, ctx, run) {
    const name = op.name.trim();
    if (!name) {
      run.fail("invalid_value", "name must not be empty");
      return;
    }
    ctx.doc.meta = { ...ctx.doc.meta, name };
  },

  setFlowNotes(op, ctx) {
    const meta = { ...ctx.doc.meta };
    if (op.notes) meta.notes = op.notes;
    else delete meta.notes;
    ctx.doc.meta = meta;
  },

  autoLayout(op, ctx, run) {
    const direction = op.direction ?? "LR";
    if (direction !== "LR" && direction !== "TB") {
      run.fail("invalid_value", 'direction must be "LR" or "TB"');
      return;
    }
    applyLayout(ctx, direction);
  },
};

function applyLayout(ctx: Context, direction: "LR" | "TB"): void {
  if (lanesOf(ctx).length > 0) {
    layoutLanes(ctx);
    ctx.laidOut = true;
    return;
  }
  const positions = layoutFlow(ctx, direction);
  ctx.doc.nodes = ctx.doc.nodes.map((node) => {
    const position = positions.get(node.id);
    return position ? { ...node, position } : node;
  });
  ctx.laidOut = true;
}

const LANE_HEADER = 60;
const LANE_PAD = 28;
const LANE_GAP = 6;
const LANE_STACK_GAP = 24;

const isLaneNode = (ctx: Context, node: FlowNode): boolean =>
  isLaneShape(ctx.registry.get(node.type).shape);

const lanesOf = (ctx: Context): FlowNode[] => ctx.doc.nodes.filter((node) => isLaneNode(ctx, node));

function findLane(ctx: Context, ref: string): FlowNode | null {
  const wanted = ref.trim();
  if (!wanted) return null;
  const lanes = lanesOf(ctx);
  const temp = ctx.temps.get(wanted);
  if (temp?.id) return lanes.find((lane) => lane.id === temp.id) ?? null;
  const lower = wanted.replace(/^#/, "").toLowerCase();
  return (
    lanes.find((lane) => lane.id === wanted.replace(/^#/, "")) ??
    lanes.find((lane) => lane.data.label.trim().toLowerCase() === lower) ??
    null
  );
}

function assignLanes(ctx: Context, lanes: FlowNode[], nodes: FlowNode[]): Map<string, number> {
  const laneIndex = new Map(lanes.map((lane, index) => [lane.id, index]));
  const assigned = new Map<string, number>();
  for (const node of nodes) {
    const explicit = ctx.laneOf.get(node.id);
    const index = explicit !== undefined ? laneIndex.get(explicit) : undefined;
    if (index !== undefined) {
      assigned.set(node.id, index);
      continue;
    }
    if (!ctx.beforePositions.has(node.id)) continue;
    const rect = rectOf(ctx, node);
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const hit = lanes.findIndex((lane) => {
      if (!ctx.beforePositions.has(lane.id)) return false;
      const box = rectOf(ctx, lane);
      return cx >= box.x && cx <= box.x + box.width && cy >= box.y && cy <= box.y + box.height;
    });
    if (hit >= 0) assigned.set(node.id, hit);
  }
  const neighbours = new Map<string, string[]>(nodes.map((node) => [node.id, []]));
  for (const edge of ctx.doc.edges) {
    neighbours.get(edge.target)?.unshift(edge.source);
    neighbours.get(edge.source)?.push(edge.target);
  }
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const node of nodes) {
      if (assigned.has(node.id)) continue;
      const known = (neighbours.get(node.id) ?? []).find((id) => assigned.has(id));
      if (known !== undefined) {
        assigned.set(node.id, assigned.get(known) as number);
        changed = true;
      }
    }
    if (!changed) break;
  }
  for (const node of nodes) if (!assigned.has(node.id)) assigned.set(node.id, 0);
  return assigned;
}

function layoutLanes(ctx: Context): void {
  const lanes = lanesOf(ctx);
  if (lanes.length === 0) return;
  const horizontal = ctx.registry.get((lanes[0] as FlowNode).type).shape === "swimlane";
  const nodes = layoutNodes(ctx, ctx.doc);
  const layers = layerNodes(ctx, nodes).filter((members) => members.length > 0);
  const assigned = assignLanes(ctx, lanes, nodes);
  const mainSize = (rect: Rect) => (horizontal ? rect.width : rect.height);
  const crossSize = (rect: Rect) => (horizontal ? rect.height : rect.width);
  const rects = new Map(nodes.map((node) => [node.id, rectOf(ctx, node)]));
  const thickness = layers.map((members) =>
    Math.max(...members.map((node) => mainSize(rects.get(node.id) as Rect))),
  );
  const mainOffset: number[] = [];
  let totalMain = 0;
  for (const size of thickness) {
    mainOffset.push(totalMain);
    totalMain += size + LAYOUT_GAP_MAIN;
  }
  totalMain = Math.max(0, totalMain - LAYOUT_GAP_MAIN);
  const cells = new Map<string, FlowNode[]>();
  layers.forEach((members, layerIndex) => {
    for (const node of members) {
      const key = `${assigned.get(node.id)}:${layerIndex}`;
      cells.set(key, [...(cells.get(key) ?? []), node]);
    }
  });
  const span = (members: FlowNode[]) =>
    members.reduce((sum, node) => sum + crossSize(rects.get(node.id) as Rect), 0) +
    LANE_STACK_GAP * Math.max(0, members.length - 1);
  const minCross = ctx.registry.get((lanes[0] as FlowNode).type).defaultSize;
  const laneCross = lanes.map((_, laneIndex) => {
    let widest = 0;
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
      widest = Math.max(widest, span(cells.get(`${laneIndex}:${layerIndex}`) ?? []));
    }
    return Math.max(horizontal ? minCross.height : minCross.width, widest + LANE_PAD * 2);
  });
  const laneStart: number[] = [];
  let crossCursor = 0;
  for (const size of laneCross) {
    laneStart.push(crossCursor);
    crossCursor += size + LANE_GAP;
  }
  const firstOld = lanes.find((lane) => ctx.beforePositions.has(lane.id));
  const origin = firstOld ? firstOld.position : { x: 0, y: 0 };
  const laneMain = LANE_HEADER + totalMain + LANE_PAD;
  const positions = new Map<string, XYPosition>();
  const sizes = new Map<string, { width: number; height: number }>();
  lanes.forEach((lane, laneIndex) => {
    const start = laneStart[laneIndex] as number;
    const cross = laneCross[laneIndex] as number;
    positions.set(
      lane.id,
      horizontal ? { x: origin.x, y: origin.y + start } : { x: origin.x + start, y: origin.y },
    );
    sizes.set(
      lane.id,
      horizontal ? { width: laneMain, height: cross } : { width: cross, height: laneMain },
    );
  });
  layers.forEach((_members, layerIndex) => {
    lanes.forEach((_, laneIndex) => {
      const cell = cells.get(`${laneIndex}:${layerIndex}`);
      if (!cell) return;
      const center = (laneStart[laneIndex] as number) + (laneCross[laneIndex] as number) / 2;
      let cursor = center - span(cell) / 2;
      for (const node of cell) {
        const rect = rects.get(node.id) as Rect;
        const along =
          LANE_HEADER +
          (mainOffset[layerIndex] as number) +
          ((thickness[layerIndex] as number) - mainSize(rect)) / 2;
        const across = cursor;
        cursor += crossSize(rect) + LANE_STACK_GAP;
        positions.set(
          node.id,
          horizontal
            ? { x: Math.round(origin.x + along), y: Math.round(origin.y + across) }
            : { x: Math.round(origin.x + across), y: Math.round(origin.y + along) },
        );
      }
    });
  });
  ctx.doc.nodes = ctx.doc.nodes.map((node) => {
    const position = positions.get(node.id);
    if (!position) return node;
    const size = sizes.get(node.id);
    return size
      ? { ...node, position: { x: Math.round(position.x), y: Math.round(position.y) }, ...size }
      : { ...node, position };
  });
}

function placeIntoLanes(ctx: Context): void {
  for (const [nodeId, laneId] of ctx.laneOf) {
    const node = getNode(ctx, nodeId);
    const lane = ctx.doc.nodes.find((item) => item.id === laneId);
    if (!node || !lane) continue;
    const horizontal = ctx.registry.get(lane.type).shape === "swimlane";
    const box = rectOf(ctx, lane);
    const rect = rectOf(ctx, node);
    const inside = ctx.doc.nodes.filter((item) => {
      if (item.id === nodeId || isLaneNode(ctx, item)) return false;
      if (ctx.laneOf.get(item.id) === laneId) return true;
      if (!ctx.beforePositions.has(item.id)) return false;
      const r = rectOf(ctx, item);
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      return cx >= box.x && cx <= box.x + box.width && cy >= box.y && cy <= box.y + box.height;
    });

    const edge = inside.reduce(
      (max, item) => {
        const r = rectOf(ctx, item);
        return Math.max(max, horizontal ? r.x + r.width : r.y + r.height);
      },
      (horizontal ? box.x : box.y) + LANE_HEADER - LAYOUT_GAP_MAIN,
    );
    const along = edge + LAYOUT_GAP_MAIN;
    const across = horizontal
      ? box.y + box.height / 2 - rect.height / 2
      : box.x + box.width / 2 - rect.width / 2;
    const next = horizontal
      ? { x: Math.round(along), y: Math.round(across) }
      : { x: Math.round(across), y: Math.round(along) };
    const grownMain = (horizontal ? next.x + rect.width : next.y + rect.height) + LANE_PAD;
    const mainNow = horizontal ? box.x + box.width : box.y + box.height;
    const grownCross = (horizontal ? rect.height : rect.width) + LANE_PAD * 2;
    ctx.doc.nodes = ctx.doc.nodes.map((item) => {
      if (item.id === nodeId) return { ...item, position: next };
      if (item.id !== laneId) return item;
      const width = horizontal
        ? Math.max(box.width, grownMain - box.x)
        : Math.max(box.width, grownCross);
      const height = horizontal
        ? Math.max(box.height, grownCross)
        : Math.max(box.height, grownMain - box.y);
      return mainNow >= grownMain && width === box.width && height === box.height
        ? item
        : { ...item, width, height };
    });
  }
}

function layoutNodes(ctx: Context, doc: FlowJSON): FlowNode[] {
  return doc.nodes.filter((node) => !isLaneShape(ctx.registry.get(node.type).shape));
}

function shouldAutoLayout(ctx: Context, before: FlowJSON): boolean {
  if (ctx.laidOut) return false;
  const existing = new Set(layoutNodes(ctx, before).map((node) => node.id));
  if (existing.size > AUTO_LAYOUT_MAX_EXISTING) return false;
  const added = layoutNodes(ctx, ctx.doc).filter((node) => !existing.has(node.id)).length;
  return added >= (existing.size === 0 ? 1 : AUTO_LAYOUT_MIN_ADDED);
}

function layerNodes(ctx: Context, nodes: FlowNode[]): FlowNode[][] {
  const ids = new Set(nodes.map((node) => node.id));
  const children = new Map<string, string[]>(nodes.map((node) => [node.id, []]));
  const handleRank = new Map<string, number>();
  for (const edge of ctx.doc.edges) {
    if (ids.has(edge.source) && ids.has(edge.target) && edge.source !== edge.target) {
      const list = children.get(edge.source) as string[];
      if (!list.includes(edge.target)) list.push(edge.target);
      const rank = HANDLE_ORDER.indexOf(edge.sourceHandle ?? "");
      if (rank >= 0) handleRank.set(`${edge.source}>${edge.target}`, rank);
    }
  }
  for (const [source, list] of children) {
    list.sort(
      (a, b) =>
        (handleRank.get(`${source}>${a}`) ?? HANDLE_ORDER.length) -
        (handleRank.get(`${source}>${b}`) ?? HANDLE_ORDER.length),
    );
  }
  const state = new Map<string, "active" | "done">();
  const acyclic = new Map<string, string[]>(nodes.map((node) => [node.id, []]));
  const visit = (id: string): void => {
    state.set(id, "active");
    for (const child of children.get(id) ?? []) {
      if (state.get(child) === "active") continue;
      acyclic.get(id)?.push(child);
      if (!state.has(child)) visit(child);
    }
    state.set(id, "done");
  };
  const indegreeAll = new Map<string, number>(nodes.map((node) => [node.id, 0]));
  for (const list of children.values()) {
    for (const child of list) indegreeAll.set(child, (indegreeAll.get(child) ?? 0) + 1);
  }
  const roots = nodes.filter((node) => indegreeAll.get(node.id) === 0);
  for (const node of [...roots, ...nodes]) if (!state.has(node.id)) visit(node.id);
  const indegree = new Map<string, number>(nodes.map((node) => [node.id, 0]));
  const parents = new Map<string, string[]>(nodes.map((node) => [node.id, []]));
  for (const [id, list] of acyclic) {
    for (const child of list) {
      indegree.set(child, (indegree.get(child) ?? 0) + 1);
      parents.get(child)?.push(id);
    }
  }
  const layer = new Map<string, number>(nodes.map((node) => [node.id, 0]));
  const queue = nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head] as string;
    for (const child of acyclic.get(id) ?? []) {
      layer.set(child, Math.max(layer.get(child) ?? 0, (layer.get(id) ?? 0) + 1));
      indegree.set(child, (indegree.get(child) ?? 0) - 1);
      if (indegree.get(child) === 0) queue.push(child);
    }
  }
  const depth = Math.max(0, ...layer.values());
  const layers: FlowNode[][] = [];
  for (let index = 0; index <= depth; index++) {
    layers.push(nodes.filter((node) => layer.get(node.id) === index));
  }
  const slot = new Map<string, number>();
  layers.forEach((members, index) => {
    if (index > 0) {
      const weight = (node: FlowNode, fallback: number) => {
        const placed = (parents.get(node.id) ?? []).flatMap((parent) => {
          const at = slot.get(parent);
          if (at === undefined) return [];
          const siblings = acyclic.get(parent) ?? [];
          const offset = siblings.length > 1 ? siblings.indexOf(node.id) / siblings.length : 0;
          return [at + offset];
        });
        return placed.length > 0
          ? placed.reduce((sum, value) => sum + value, 0) / placed.length
          : fallback;
      };
      const weights = new Map(members.map((node, i) => [node.id, weight(node, i)]));
      members.sort((a, b) => (weights.get(a.id) ?? 0) - (weights.get(b.id) ?? 0));
    }
    members.forEach((node, i) => slot.set(node.id, i));
  });
  return layers;
}

function layoutFlow(ctx: Context, direction: "LR" | "TB"): Map<string, XYPosition> {
  const layers = layerNodes(ctx, layoutNodes(ctx, ctx.doc)).filter((members) => members.length > 0);
  const horizontal = direction === "LR";
  const mainSize = (rect: Rect) => (horizontal ? rect.width : rect.height);
  const crossSize = (rect: Rect) => (horizontal ? rect.height : rect.width);
  const measured = layers.map((members) => {
    const rects = members.map((node) => rectOf(ctx, node));
    return {
      members,
      rects,
      thickness: Math.max(...rects.map(mainSize)),
      span:
        rects.reduce((sum, rect) => sum + crossSize(rect), 0) +
        LAYOUT_GAP_CROSS * (members.length - 1),
    };
  });
  const totalMain = measured.reduce((sum, layer) => sum + layer.thickness + LAYOUT_GAP_MAIN, 0);
  const totalArea = measured.reduce(
    (sum, layer) => sum + (layer.thickness + LAYOUT_GAP_MAIN) * (layer.span + LAYOUT_BAND_GAP),
    0,
  );
  const widest = Math.max(0, ...measured.map((layer) => layer.thickness));
  const bandMain = Math.max(
    widest,
    Math.min(
      LAYOUT_MAX_BAND_MAIN,
      Math.max(LAYOUT_MIN_BAND_MAIN, Math.sqrt(totalArea * LAYOUT_TARGET_ASPECT)),
    ),
  );
  const bands: (typeof measured)[] = [];
  if (totalMain <= bandMain) {
    bands.push(measured);
  } else {
    let current: typeof measured = [];
    let used = 0;
    for (const layer of measured) {
      const need = layer.thickness + LAYOUT_GAP_MAIN;
      if (current.length > 0 && used + need > bandMain) {
        bands.push(current);
        current = [];
        used = 0;
      }
      current.push(layer);
      used += need;
    }
    if (current.length > 0) bands.push(current);
  }
  const layerOf = new Map<string, number>();
  measured.forEach((layer, index) => layer.members.forEach((node) => layerOf.set(node.id, index)));
  const parentsOf = new Map<string, string[]>();
  for (const edge of ctx.doc.edges) {
    const from = layerOf.get(edge.source);
    const to = layerOf.get(edge.target);
    if (from === undefined || to === undefined || from >= to) continue;
    const list = parentsOf.get(edge.target) ?? [];
    if (!list.includes(edge.source)) list.push(edge.source);
    parentsOf.set(edge.target, list);
  }
  const centerOf = new Map<string, number>();
  const sizeOf = new Map<string, number>();
  measured.forEach((layer) =>
    layer.members.forEach((node, i) => sizeOf.set(node.id, crossSize(layer.rects[i] as Rect))),
  );
  const soleParent = (id: string): string | null => {
    const list = (parentsOf.get(id) ?? []).filter((parent) => centerOf.has(parent));
    return list.length === 1 ? (list[0] as string) : null;
  };
  for (const layer of measured) {
    let cursor = Number.NEGATIVE_INFINITY;
    const place = (group: FlowNode[], wanted: number | null) => {
      const sizes = group.map((node) => sizeOf.get(node.id) as number);
      const span =
        sizes.reduce((sum, size) => sum + size, 0) + LAYOUT_GAP_CROSS * (group.length - 1);
      const floor = Number.isFinite(cursor) ? cursor : Number.NEGATIVE_INFINITY;
      let top = Math.max(
        wanted === null ? (Number.isFinite(cursor) ? cursor : -span / 2) : wanted - span / 2,
        floor,
      );
      group.forEach((node, i) => {
        centerOf.set(node.id, top + (sizes[i] as number) / 2);
        top += (sizes[i] as number) + LAYOUT_GAP_CROSS;
      });
      cursor = top;
    };
    let index = 0;
    while (index < layer.members.length) {
      const node = layer.members[index] as FlowNode;
      const parent = soleParent(node.id);
      if (parent !== null) {
        let end = index + 1;
        while (
          end < layer.members.length &&
          soleParent((layer.members[end] as FlowNode).id) === parent
        )
          end++;
        place(layer.members.slice(index, end), centerOf.get(parent) as number);
        index = end;
        continue;
      }
      const parents = (parentsOf.get(node.id) ?? []).filter((id) => centerOf.has(id));
      const wanted =
        parents.length > 0
          ? parents.reduce((sum, id) => sum + (centerOf.get(id) as number), 0) / parents.length
          : null;
      place([node], wanted);
      index++;
    }
  }
  const positions = new Map<string, XYPosition>();
  let previousBottom = 0;
  bands.forEach((band, bandIndex) => {
    const members = band.flatMap((layer) => layer.members);
    const top = Math.min(
      ...members.map(
        (node) => (centerOf.get(node.id) as number) - (sizeOf.get(node.id) as number) / 2,
      ),
    );
    const bottom = Math.max(
      ...members.map(
        (node) => (centerOf.get(node.id) as number) + (sizeOf.get(node.id) as number) / 2,
      ),
    );
    const shift = bandIndex === 0 ? 0 : previousBottom + LAYOUT_BAND_GAP - top;
    previousBottom = bottom + shift;
    const bandLength =
      band.reduce((sum, layer) => sum + layer.thickness, 0) + LAYOUT_GAP_MAIN * (band.length - 1);
    const reversed = bandIndex % 2 === 1;
    let main = 0;
    for (const layer of band) {
      layer.members.forEach((node, i) => {
        const rect = layer.rects[i] as Rect;
        const local = main + (layer.thickness - mainSize(rect)) / 2;
        const along = Math.round(reversed ? bandLength - local - mainSize(rect) : local);
        const across = Math.round((centerOf.get(node.id) as number) - crossSize(rect) / 2 + shift);
        positions.set(node.id, horizontal ? { x: along, y: across } : { x: across, y: along });
      });
      main += layer.thickness + LAYOUT_GAP_MAIN;
    }
  });
  const anchor = layers.flat().find((node) => ctx.beforePositions.has(node.id));
  const was = anchor ? ctx.beforePositions.get(anchor.id) : undefined;
  const now = anchor ? positions.get(anchor.id) : undefined;
  if (!was || !now) return positions;
  const dx = was.x - now.x;
  const dy = was.y - now.y;
  for (const [id, position] of positions) {
    positions.set(id, { x: position.x + dx, y: position.y + dy });
  }
  return positions;
}

function repickHandles(ctx: Context): void {
  for (const edgeId of ctx.autoHandleEdges) {
    const edge = ctx.doc.edges.find((item) => item.id === edgeId);
    if (!edge) continue;
    const source = getNode(ctx, edge.source);
    const target = getNode(ctx, edge.target);
    const handles = pickHandles(
      ctx,
      source,
      target,
      source.type === DECISION_TYPE ? edge.sourceHandle : undefined,
      undefined,
    );
    if (handles.sourceHandle === edge.sourceHandle && handles.targetHandle === edge.targetHandle) {
      continue;
    }
    const candidate = { ...edge, ...handles } as FlowEdge;
    if (!connectionError(ctx, candidate, edge.id)) {
      ctx.doc.edges = ctx.doc.edges.map((item) => (item.id === edgeId ? candidate : item));
    }
  }
}

function declaredTemp(op: FlowOp): { tempId: string; kind: RefKind } | null {
  if (op.op === "addNode" || op.op === "insertNodeOnEdge") {
    return op.tempId !== undefined ? { tempId: op.tempId, kind: "node" } : null;
  }
  if (op.op === "addEdge")
    return op.tempId !== undefined ? { tempId: op.tempId, kind: "edge" } : null;
  return null;
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

function newIssues(ctx: Context, before: FlowJSON, after: FlowJSON): string[] {
  const key = (issue: { code: string; message: string }) => `${issue.code}|${issue.message}`;
  const known = new Set(validateFlow(before, ctx.registry).issues.map(key));
  return validateFlow(after, ctx.registry)
    .issues.filter((issue) => !known.has(key(issue)))
    .map((issue) => `${issue.severity}: ${issue.message}`);
}

export function applyFlowOps(
  input: FlowJSON,
  ops: readonly FlowOp[],
  options: ApplyFlowOpsOptions = {},
): ApplyOpsResult<FlowJSON> {
  let before: FlowJSON;
  try {
    before = parseFlow(cloneJson(input));
  } catch (err) {
    return {
      ok: false,
      errors: [
        {
          index: -1,
          op: "",
          code: "invalid_value",
          message: `The current flow is invalid: ${errorMessage(err)}`,
        },
      ],
    };
  }
  const errors: OpError[] = [];
  if (ops.length > AI_FLOW_LIMITS.maxOpsPerBatch) {
    errors.push({
      index: -1,
      op: "",
      code: "limit_exceeded",
      message: `A batch may contain at most ${AI_FLOW_LIMITS.maxOpsPerBatch} ops (got ${ops.length})`,
    });
  }
  const ctx: Context = {
    doc: cloneJson(before),
    registry: new NodeTypeRegistry([...(options.nodeTypes ?? builtInNodeTypes)]),
    temps: new TempIds(),
    ids: new IdFactory(options.createId ?? createId, [
      ...before.nodes.map((node) => node.id),
      ...before.edges.map((edge) => edge.id),
    ]),
    lastAddedId: null,
    autoHandleEdges: new Set(),
    laidOut: false,
    beforePositions: new Map(before.nodes.map((node) => [node.id, node.position])),
    skipped: [],
    laneOf: new Map(),
    laneAdded: false,
  };
  ops.forEach((op, index) => {
    const opErrors: OpError[] = [];
    const name = typeof op?.op === "string" ? op.op : "";
    const run: Run = {
      fail: (code, message) => opErrors.push({ index, op: name, code, message }),
      failed: () => opErrors.length > 0,
    };
    const handler = Object.prototype.hasOwnProperty.call(HANDLERS, name)
      ? (HANDLERS[name as FlowOpName] as (op: FlowOp, ctx: Context, run: Run) => void)
      : null;
    if (!handler) {
      run.fail("unknown_op", `Unknown op "${name}"`);
    } else {
      try {
        handler(op, ctx, run);
      } catch (err) {
        run.fail("invalid_shape", errorMessage(err));
      }
    }
    if (opErrors.length > 0) {
      errors.push(...opErrors);
      const temp = handler ? declaredTemp(op) : null;
      if (temp) ctx.temps.poison(temp.tempId, temp.kind, index);
    }
  });
  if (errors.length === 0) {
    if (ctx.laneAdded && !ctx.laidOut) applyLayout(ctx, "LR");
    else if (shouldAutoLayout(ctx, before)) applyLayout(ctx, "LR");
    else if (ctx.laneOf.size > 0 && !ctx.laidOut) placeIntoLanes(ctx);
  }
  repickHandles(ctx);
  if (ctx.doc.nodes.length > AI_FLOW_LIMITS.maxNodes) {
    errors.push({
      index: -1,
      op: "",
      code: "limit_exceeded",
      message: `A flow may have at most ${AI_FLOW_LIMITS.maxNodes} nodes (would have ${ctx.doc.nodes.length})`,
    });
  }
  if (ctx.doc.edges.length > AI_FLOW_LIMITS.maxEdges) {
    errors.push({
      index: -1,
      op: "",
      code: "limit_exceeded",
      message: `A flow may have at most ${AI_FLOW_LIMITS.maxEdges} edges (would have ${ctx.doc.edges.length})`,
    });
  }
  if (errors.length > 0) return { ok: false, errors };
  let document: FlowJSON;
  try {
    document = parseFlow(cloneJson(ctx.doc));
  } catch (err) {
    return {
      ok: false,
      errors: [
        {
          index: -1,
          op: "",
          code: "invalid_value",
          message: `The result is not a valid flow: ${errorMessage(err)}`,
        },
      ],
    };
  }
  return {
    ok: true,
    document,
    idMap: ctx.temps.toIdMap(),
    diff: diffFlow(before, document),
    warnings: [...ctx.skipped, ...newIssues(ctx, before, document)],
  };
}

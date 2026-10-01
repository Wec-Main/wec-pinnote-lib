import type { Dimensions, XYPosition } from "../../types/flowchart.types";
import type { ErdEntity, ErdRelationship } from "../../types/dataModel.types";
import { GRID_GAP, LAYER_GAP_X, LAYER_GAP_Y } from "./erdConstants";

export type ErdLayoutMode = "grid" | "layered";
export type ErdMeasure = (entity: ErdEntity) => Dimensions;
export type ErdPositions = Record<string, XYPosition>;

function gridPositions(
  entities: readonly ErdEntity[],
  measure: ErdMeasure,
  origin: XYPosition,
): ErdPositions {
  const columns = Math.max(1, Math.ceil(Math.sqrt(entities.length)));
  const sizes = entities.map(measure);
  const rowCount = Math.ceil(entities.length / columns);
  const columnWidths = Array.from({ length: columns }, (_, column) =>
    Math.max(0, ...sizes.filter((_size, i) => i % columns === column).map((size) => size.width)),
  );
  const rowHeights = Array.from({ length: rowCount }, (_, row) =>
    Math.max(0, ...sizes.slice(row * columns, row * columns + columns).map((size) => size.height)),
  );
  const columnX = columnWidths.map((_, column) =>
    columnWidths.slice(0, column).reduce((sum, width) => sum + width + GRID_GAP, origin.x),
  );
  const rowY = rowHeights.map((_, row) =>
    rowHeights.slice(0, row).reduce((sum, height) => sum + height + GRID_GAP, origin.y),
  );
  return Object.fromEntries(
    entities.map((entity, i) => [
      entity.id,
      { x: columnX[i % columns] ?? origin.x, y: rowY[Math.floor(i / columns)] ?? origin.y },
    ]),
  );
}

function childrenByParent(
  entities: readonly ErdEntity[],
  relationships: readonly ErdRelationship[],
): Map<string, string[]> {
  const known = new Set(entities.map((entity) => entity.id));
  const children = new Map<string, string[]>(entities.map((entity) => [entity.id, []]));
  for (const rel of relationships) {
    const isLink =
      known.has(rel.sourceEntityId) &&
      known.has(rel.targetEntityId) &&
      rel.sourceEntityId !== rel.targetEntityId;
    const list = children.get(rel.sourceEntityId);
    if (isLink && list && !list.includes(rel.targetEntityId)) list.push(rel.targetEntityId);
  }
  return children;
}

function breakCycles(
  entities: readonly ErdEntity[],
  children: Map<string, string[]>,
): Map<string, string[]> {
  const state = new Map<string, "active" | "done">();
  const acyclic = new Map<string, string[]>(entities.map((entity) => [entity.id, []]));
  const visit = (id: string): void => {
    state.set(id, "active");
    for (const child of children.get(id) ?? []) {
      if (state.get(child) === "active") continue;
      acyclic.get(id)?.push(child);
      if (!state.has(child)) visit(child);
    }
    state.set(id, "done");
  };
  for (const entity of entities) {
    if (!state.has(entity.id)) visit(entity.id);
  }
  return acyclic;
}

function longestPathLayers(
  entities: readonly ErdEntity[],
  children: Map<string, string[]>,
): Map<string, number> {
  const layers = new Map<string, number>(entities.map((entity) => [entity.id, 0]));
  const indegree = new Map<string, number>(entities.map((entity) => [entity.id, 0]));
  for (const list of children.values()) {
    for (const child of list) indegree.set(child, (indegree.get(child) ?? 0) + 1);
  }
  const queue = entities
    .filter((entity) => indegree.get(entity.id) === 0)
    .map((entity) => entity.id);
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head] as string;
    for (const child of children.get(id) ?? []) {
      layers.set(child, Math.max(layers.get(child) ?? 0, (layers.get(id) ?? 0) + 1));
      indegree.set(child, (indegree.get(child) ?? 0) - 1);
      if (indegree.get(child) === 0) queue.push(child);
    }
  }
  return layers;
}

function orderLayers(
  entities: readonly ErdEntity[],
  layers: Map<string, number>,
  children: Map<string, string[]>,
): string[][] {
  const depth = Math.max(0, ...layers.values());
  const documentIndex = new Map(entities.map((entity, i) => [entity.id, i]));
  const parents = new Map<string, string[]>(entities.map((entity) => [entity.id, []]));
  for (const [parent, list] of children) {
    for (const child of list) parents.get(child)?.push(parent);
  }
  const ordered: string[][] = [];
  const rank = new Map<string, number>();
  for (let layer = 0; layer <= depth; layer++) {
    const members = entities
      .filter((entity) => layers.get(entity.id) === layer)
      .map((entity) => entity.id);
    const barycenter = (id: string): number => {
      const ranks = (parents.get(id) ?? []).map((parent) => rank.get(parent) ?? 0);
      if (ranks.length === 0) return documentIndex.get(id) ?? 0;
      return ranks.reduce((sum, value) => sum + value, 0) / ranks.length;
    };
    members.sort(
      (a, b) =>
        barycenter(a) - barycenter(b) || (documentIndex.get(a) ?? 0) - (documentIndex.get(b) ?? 0),
    );
    members.forEach((id, i) => rank.set(id, i));
    ordered.push(members);
  }
  return ordered;
}

function layeredPositions(
  entities: readonly ErdEntity[],
  relationships: readonly ErdRelationship[],
  measure: ErdMeasure,
): ErdPositions {
  const children = childrenByParent(entities, relationships);
  const linked = new Set<string>();
  for (const [parent, list] of children) {
    if (list.length > 0) linked.add(parent);
    for (const child of list) linked.add(child);
  }
  const connected = entities.filter((entity) => linked.has(entity.id));
  const isolated = entities.filter((entity) => !linked.has(entity.id));
  const acyclic = breakCycles(connected, children);
  const layers = longestPathLayers(connected, acyclic);
  const columns = connected.length === 0 ? [] : orderLayers(connected, layers, acyclic);
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const positions: ErdPositions = {};
  let x = 0;
  let bottom = 0;
  for (const column of columns) {
    const sizes = column.map((id) => measure(byId.get(id) as ErdEntity));
    let y = 0;
    column.forEach((id, i) => {
      positions[id] = { x, y };
      y += (sizes[i] as Dimensions).height + LAYER_GAP_Y;
    });
    bottom = Math.max(bottom, y - LAYER_GAP_Y);
    x += Math.max(...sizes.map((size) => size.width)) + LAYER_GAP_X;
  }
  const origin = { x: 0, y: columns.length === 0 ? 0 : bottom + GRID_GAP };
  return { ...positions, ...gridPositions(isolated, measure, origin) };
}

export function layoutErd(
  mode: ErdLayoutMode,
  entities: readonly ErdEntity[],
  relationships: readonly ErdRelationship[],
  measure: ErdMeasure,
): ErdPositions {
  if (mode === "grid") return gridPositions(entities, measure, { x: 0, y: 0 });
  return layeredPositions(entities, relationships, measure);
}

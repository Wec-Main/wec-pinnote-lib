import type { AiChangeSummary } from "../../types/ai.types";
import type { ErdDocumentJSON } from "../../types/dataModel.types";
import type { FlowJSON } from "../../types/flowchart.types";
import type { DocDiff, ErdSummary, ErdSummaryEntity, FlowSummary } from "./types";

const DEFAULT_MAX_ENTITIES = 200;

export function summarizeChanges(diff: DocDiff): AiChangeSummary {
  return {
    added: diff.added.length,
    changed: diff.changed.length,
    removed: diff.removed.length,
  };
}

export function summarizeErd(
  doc: ErdDocumentJSON,
  options: { entityIds?: readonly string[]; maxEntities?: number } = {},
): ErdSummary {
  const wanted = options.entityIds ? new Set(options.entityIds) : null;
  const max = Math.max(0, options.maxEntities ?? DEFAULT_MAX_ENTITIES);
  const pool = wanted ? doc.entities.filter((entity) => wanted.has(entity.id)) : doc.entities;
  const listed = pool.slice(0, max);
  const enumNames = new Map(doc.enums.map((entry) => [entry.id, entry.name]));
  const entityNames = new Map(doc.entities.map((entity) => [entity.id, entity.name]));
  const entities = listed.map((entity): ErdSummaryEntity => {
    const summary: ErdSummaryEntity = {
      id: entity.id,
      name: entity.name,
      fieldCount: entity.fields.length,
      fieldNames: entity.fields.map((field) => field.name),
    };
    if (entity.schema !== undefined) summary.schema = entity.schema;
    if (wanted) {
      summary.fields = entity.fields.map((field) => {
        const enumName = field.enumId ? enumNames.get(field.enumId) : undefined;
        return {
          id: field.id,
          name: field.name,
          type: field.type,
          primaryKey: field.primaryKey,
          nullable: field.nullable,
          unique: field.unique,
          ...(enumName !== undefined ? { enum: enumName } : {}),
        };
      });
    }
    return summary;
  });
  const listedIds = new Set(listed.map((entity) => entity.id));
  return {
    name: doc.meta.name ?? "",
    engine: doc.engine,
    entityCount: doc.entities.length,
    relationshipCount: doc.relationships.length,
    enumCount: doc.enums.length,
    noteCount: doc.notes.length,
    truncated: listed.length < (wanted ? pool.length : doc.entities.length),
    entities,
    relationships: doc.relationships
      .filter((rel) => listedIds.has(rel.sourceEntityId) || listedIds.has(rel.targetEntityId))
      .map((rel) => ({
        id: rel.id,
        ...(rel.name !== undefined ? { name: rel.name } : {}),
        source: entityNames.get(rel.sourceEntityId) ?? rel.sourceEntityId,
        target: entityNames.get(rel.targetEntityId) ?? rel.targetEntityId,
        cardinality: rel.cardinality,
      })),
    enums: doc.enums.map((entry) => ({
      id: entry.id,
      name: entry.name,
      values: [...entry.values],
    })),
  };
}

export function summarizeFlow(doc: FlowJSON): FlowSummary {
  return {
    name: typeof doc.meta?.name === "string" ? doc.meta.name : null,
    nodeCount: doc.nodes.length,
    edgeCount: doc.edges.length,
    nodes: doc.nodes.map((node) => ({ id: node.id, type: node.type, label: node.data.label })),
    edges: doc.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...(edge.sourceHandle !== undefined ? { sourceHandle: edge.sourceHandle } : {}),
      ...(edge.label !== undefined ? { label: edge.label } : {}),
    })),
  };
}

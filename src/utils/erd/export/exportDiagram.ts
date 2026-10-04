import type {
  ErdDocumentJSON,
  ErdEntity,
  ErdField,
  ErdRelationship,
} from "../../../types/dataModel.types";
import { svgToPngDataUrl } from "../../svgToPngDataUrl";
import { ENTITY_HEADER_HEIGHT, FIELD_ROW_HEIGHT } from "../erdConstants";
import { getEntityRect, type ErdSide } from "../erdGeometry";
import { formatFieldType } from "../erdTypes";
import { relationshipEndKinds, relationshipGeometry } from "../relationshipPath";

const DIAGRAM_PADDING = 60;
const DEFAULT_HEADER_FILL = "#2563eb";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fkFieldKeys(document: ErdDocumentJSON): Set<string> {
  const keys = new Set<string>();
  for (const relationship of document.relationships) {
    const ids =
      relationship.targetFieldIds && relationship.targetFieldIds.length > 0
        ? relationship.targetFieldIds
        : relationship.targetFieldId
          ? [relationship.targetFieldId]
          : [];
    for (const id of ids) keys.add(`${relationship.targetEntityId}:${id}`);
  }
  return keys;
}

function fieldRowMarkup(
  entity: ErdEntity,
  field: ErdField,
  rect: { x: number; y: number; width: number },
  index: number,
  fkKeys: ReadonlySet<string>,
): string {
  const y = rect.y + ENTITY_HEADER_HEIGHT + index * FIELD_ROW_HEIGHT;
  const textY = y + FIELD_ROW_HEIGHT / 2 + 4;
  const marker = field.primaryKey ? "PK" : fkKeys.has(`${entity.id}:${field.id}`) ? "FK" : "";
  const markerSpan = marker ? `<tspan font-weight="700" fill="#b45309">${marker} </tspan>` : "";
  const label = `${field.name}${field.nullable ? "?" : ""}`;
  const type = formatFieldType(field);
  const divider =
    index > 0
      ? `<line x1="${rect.x}" y1="${y}" x2="${rect.x + rect.width}" y2="${y}" stroke="#e2e8f0" stroke-width="1" />`
      : "";
  const text = `<text x="${rect.x + 10}" y="${textY}" fill="#0f172a">${markerSpan}<tspan>${escapeXml(label)}</tspan><tspan x="${rect.x + rect.width - 10}" text-anchor="end" fill="#64748b">${escapeXml(type)}</tspan></text>`;
  return [divider, text].filter(Boolean).join("\n");
}

function entityGroup(entity: ErdEntity, fkKeys: ReadonlySet<string>): string {
  const rect = getEntityRect(entity);
  const headerFill = entity.color ?? DEFAULT_HEADER_FILL;
  const header = `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${ENTITY_HEADER_HEIGHT}" fill="${headerFill}" />`;
  const headerText = `<text x="${rect.x + 10}" y="${rect.y + ENTITY_HEADER_HEIGHT / 2 + 4}" fill="#ffffff" font-weight="700">${escapeXml(entity.name)}</text>`;
  const bodyHeight = Math.max(rect.height - ENTITY_HEADER_HEIGHT, 0);
  const body = `<rect x="${rect.x}" y="${rect.y + ENTITY_HEADER_HEIGHT}" width="${rect.width}" height="${bodyHeight}" fill="#ffffff" />`;
  const outline = `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" fill="none" stroke="#1e293b" stroke-width="1.5" />`;
  const fields = entity.collapsed
    ? []
    : entity.fields.map((field, index) => fieldRowMarkup(entity, field, rect, index, fkKeys));
  return `<g>\n${header}\n${body}\n${fields.join("\n")}\n${outline}\n${headerText}\n</g>`;
}

function cardinalityLabel(kind: "one" | "many"): string {
  return kind === "many" ? "n" : "1";
}

function endLabel(point: { x: number; y: number }, side: ErdSide, label: string): string {
  const offset = side === "right" ? 8 : -8;
  const anchor = side === "right" ? "start" : "end";
  return `<text x="${point.x + offset}" y="${point.y - 6}" text-anchor="${anchor}" fill="#475569" font-size="11">${label}</text>`;
}

function relationshipGroup(
  relationship: ErdRelationship,
  lookup: ReadonlyMap<string, ErdEntity>,
): string {
  const geometry = relationshipGeometry(relationship, lookup);
  if (!geometry) return "";
  const { sourceAnchor: start, targetAnchor: end, sourceSide, targetSide } = geometry;
  const kinds = relationshipEndKinds(relationship.cardinality);
  return [
    `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="#94a3b8" stroke-width="1.5" />`,
    endLabel(start, sourceSide, cardinalityLabel(kinds.source)),
    endLabel(end, targetSide, cardinalityLabel(kinds.target)),
  ].join("\n");
}

export function generateDiagramSvg(document: ErdDocumentJSON): string {
  const entities = document.entities;
  if (entities.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" width="400" height="200" font-family="sans-serif" font-size="12"></svg>`;
  }
  const rects = entities.map((entity) => getEntityRect(entity));
  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));
  const viewX = minX - DIAGRAM_PADDING;
  const viewY = minY - DIAGRAM_PADDING;
  const viewWidth = maxX - minX + DIAGRAM_PADDING * 2;
  const viewHeight = maxY - minY + DIAGRAM_PADDING * 2;

  const lookup = new Map(entities.map((entity) => [entity.id, entity]));
  const fkKeys = fkFieldKeys(document);
  const relationshipMarkup = document.relationships
    .map((relationship) => relationshipGroup(relationship, lookup))
    .filter(Boolean)
    .join("\n");
  const entityMarkup = entities.map((entity) => entityGroup(entity, fkKeys)).join("\n");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewX} ${viewY} ${viewWidth} ${viewHeight}" width="${viewWidth}" height="${viewHeight}" font-family="sans-serif" font-size="12">`,
    `<rect x="${viewX}" y="${viewY}" width="${viewWidth}" height="${viewHeight}" fill="#f8fafc" />`,
    relationshipMarkup,
    entityMarkup,
    `</svg>`,
  ]
    .filter(Boolean)
    .join("\n");
}

export const generateDiagramPngDataUrl = svgToPngDataUrl;

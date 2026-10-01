import type { Rect, XYPosition } from "../../types/flowchart.types";
import type { ErdEntity, ErdNote } from "../../types/dataModel.types";
import {
  ENTITY_BODY_PADDING,
  ENTITY_DEFAULT_WIDTH,
  ENTITY_HEADER_HEIGHT,
  FIELD_ROW_HEIGHT,
} from "./erdConstants";

export type ErdSide = "left" | "right";

export function entityHeight(entity: Pick<ErdEntity, "collapsed" | "fields">): number {
  if (entity.collapsed) return ENTITY_HEADER_HEIGHT;
  return ENTITY_HEADER_HEIGHT + entity.fields.length * FIELD_ROW_HEIGHT + ENTITY_BODY_PADDING;
}

export function getEntityRect(entity: ErdEntity): Rect {
  return {
    x: entity.position.x,
    y: entity.position.y,
    width: entity.width ?? ENTITY_DEFAULT_WIDTH,
    height: entityHeight(entity),
  };
}

export function getNoteRect(note: ErdNote): Rect {
  return { x: note.position.x, y: note.position.y, width: note.width, height: note.height };
}

export function fieldAnchor(entity: ErdEntity, fieldId: string, side: ErdSide): XYPosition {
  const rect = getEntityRect(entity);
  const x = side === "left" ? rect.x : rect.x + rect.width;
  const index = entity.fields.findIndex((field) => field.id === fieldId);
  if (entity.collapsed || index < 0) {
    return { x, y: rect.y + ENTITY_HEADER_HEIGHT / 2 };
  }
  return { x, y: rect.y + ENTITY_HEADER_HEIGHT + index * FIELD_ROW_HEIGHT + FIELD_ROW_HEIGHT / 2 };
}

export function entityAnchor(entity: ErdEntity, side: ErdSide): XYPosition {
  const rect = getEntityRect(entity);
  return {
    x: side === "left" ? rect.x : rect.x + rect.width,
    y: rect.y + rect.height / 2,
  };
}

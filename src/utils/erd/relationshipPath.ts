import type { HandleSide, Rect, XYPosition } from "../../types/flowchart.types";
import type { ErdCardinality, ErdEntity, ErdRelationship } from "../../types/dataModel.types";
import { getEdgePath } from "../flowchart/edgePaths";
import { sideVector } from "../flowchart/geometry";
import { MARKER_HALF_SPREAD, MARKER_LENGTH } from "./erdConstants";
import { entityAnchor, getEntityRect, type ErdSide } from "./erdGeometry";

export type CrowFootKind = "one" | "many";

export interface ErdRelationshipGeometry {
  sourceAnchor: XYPosition;
  targetAnchor: XYPosition;
  sourceSide: ErdSide;
  targetSide: ErdSide;
  sourceKind: CrowFootKind;
  targetKind: CrowFootKind;
  path: string;
  labelX: number;
  labelY: number;
}

const MARKER_BAR_POSITIONS = { first: 0.45, second: 0.7 } as const;
const MARKER_CONVERGENCE = 0.6;
const MARKER_CIRCLE_CENTER = 0.8;
const MARKER_CIRCLE_RADIUS = 4;

const round = (value: number) => Math.round(value * 100) / 100;
const point = (p: XYPosition) => `${round(p.x)},${round(p.y)}`;

export function relationshipEndKinds(cardinality: ErdCardinality): {
  source: CrowFootKind;
  target: CrowFootKind;
} {
  if (cardinality === "one-to-one") return { source: "one", target: "one" };
  if (cardinality === "one-to-many") return { source: "one", target: "many" };
  return { source: "many", target: "many" };
}

export function chooseSides(
  sourceRect: Rect,
  targetRect: Rect,
): { sourceSide: ErdSide; targetSide: ErdSide } {
  if (sourceRect.x + sourceRect.width <= targetRect.x) {
    return { sourceSide: "right", targetSide: "left" };
  }
  if (targetRect.x + targetRect.width <= sourceRect.x) {
    return { sourceSide: "left", targetSide: "right" };
  }
  return { sourceSide: "right", targetSide: "right" };
}

function pushOut(anchor: XYPosition, side: HandleSide, distance: number): XYPosition {
  const vector = sideVector[side];
  return { x: anchor.x + vector.x * distance, y: anchor.y + vector.y * distance };
}

export function relationshipGeometry(
  relationship: ErdRelationship,
  lookup: ReadonlyMap<string, ErdEntity>,
): ErdRelationshipGeometry | null {
  const source = lookup.get(relationship.sourceEntityId);
  const target = lookup.get(relationship.targetEntityId);
  if (!source || !target) return null;
  const { sourceSide, targetSide } = chooseSides(getEntityRect(source), getEntityRect(target));
  const sourceAnchor = entityAnchor(source, sourceSide);
  const targetAnchor = entityAnchor(target, targetSide);
  const route = getEdgePath("step", {
    source: pushOut(sourceAnchor, sourceSide, MARKER_LENGTH),
    sourceSide,
    target: pushOut(targetAnchor, targetSide, MARKER_LENGTH),
    targetSide,
  });
  const kinds = relationshipEndKinds(relationship.cardinality);
  return {
    sourceAnchor,
    targetAnchor,
    sourceSide,
    targetSide,
    sourceKind: kinds.source,
    targetKind: kinds.target,
    path: `M ${point(sourceAnchor)} ${route.path.replace(/^M/, "L")} L ${point(targetAnchor)}`,
    labelX: route.labelX,
    labelY: route.labelY,
  };
}

function segment(from: XYPosition, to: XYPosition): string {
  return `M ${point(from)} L ${point(to)}`;
}

function circle(center: XYPosition, perp: XYPosition): string {
  const left = {
    x: center.x - perp.x * MARKER_CIRCLE_RADIUS,
    y: center.y - perp.y * MARKER_CIRCLE_RADIUS,
  };
  const right = {
    x: center.x + perp.x * MARKER_CIRCLE_RADIUS,
    y: center.y + perp.y * MARKER_CIRCLE_RADIUS,
  };
  const arc = `A ${MARKER_CIRCLE_RADIUS} ${MARKER_CIRCLE_RADIUS} 0 1 0`;
  return `M ${point(left)} ${arc} ${point(right)} ${arc} ${point(left)}`;
}

export function crowFootGlyph(
  anchor: XYPosition,
  side: HandleSide,
  kind: CrowFootKind,
  optional: boolean,
): string {
  const along = sideVector[side];
  const perp = { x: -along.y, y: along.x };
  const at = (fraction: number): XYPosition => ({
    x: anchor.x + along.x * MARKER_LENGTH * fraction,
    y: anchor.y + along.y * MARKER_LENGTH * fraction,
  });
  const offset = (from: XYPosition, amount: number): XYPosition => ({
    x: from.x + perp.x * amount,
    y: from.y + perp.y * amount,
  });
  const bar = (fraction: number) =>
    segment(offset(at(fraction), MARKER_HALF_SPREAD), offset(at(fraction), -MARKER_HALF_SPREAD));
  const parts: string[] = [];
  if (kind === "many") {
    const tip = at(MARKER_CONVERGENCE);
    parts.push(
      segment(tip, offset(anchor, MARKER_HALF_SPREAD)),
      segment(tip, anchor),
      segment(tip, offset(anchor, -MARKER_HALF_SPREAD)),
    );
    parts.push(optional ? circle(at(MARKER_CIRCLE_CENTER), perp) : bar(MARKER_CIRCLE_CENTER));
  } else {
    parts.push(bar(MARKER_BAR_POSITIONS.first));
    parts.push(
      optional ? circle(at(MARKER_CIRCLE_CENTER), perp) : bar(MARKER_BAR_POSITIONS.second),
    );
  }
  return parts.join(" ");
}

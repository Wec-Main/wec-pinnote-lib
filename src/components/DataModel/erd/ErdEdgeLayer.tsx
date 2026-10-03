import { memo, useMemo } from "react";
import { useErdContext, useErdState } from "../../../context/ErdContext";
import type { ErdEntity } from "../../../types/dataModel.types";
import type { XYPosition } from "../../../types/flowchart.types";
import { entityAnchor, getEntityRect, type ErdSide } from "../../../utils/erd/erdGeometry";
import {
  chooseSides,
  crowFootGlyph,
  relationshipGeometry,
} from "../../../utils/erd/relationshipPath";
import { getEdgePath } from "../../../utils/flowchart/edgePaths";
import { cx, shallowEqual } from "../../../utils/flowchart/shallow";
import { aiMarkClass, useAiPreviewMark } from "../../Ai/AiPreviewScope";

const OPPOSITE_SIDE: Record<ErdSide, ErdSide> = { left: "right", right: "left" };
const CONNECTION_ENDPOINT_RADIUS = 3.5;

const RelationshipEdge = memo(function RelationshipEdge({ id }: { id: string }) {
  const { engine, canvasRef } = useErdContext();
  const relationship = useErdState((s) => s.relationshipLookup.get(id));
  const source = useErdState((s) => {
    const rel = s.relationshipLookup.get(id);
    return rel ? s.entityLookup.get(rel.sourceEntityId) : undefined;
  });
  const target = useErdState((s) => {
    const rel = s.relationshipLookup.get(id);
    return rel ? s.entityLookup.get(rel.targetEntityId) : undefined;
  });
  const selected = useErdState((s) => s.selection.relationshipIds.has(id));
  const issue = useErdState((s) => s.issueRelationshipIds.get(id));
  const aiMark = useAiPreviewMark("data_model", id);

  const geometry = useMemo(() => {
    if (!relationship || !source || !target) return null;
    const lookup = new Map<string, ErdEntity>([
      [source.id, source],
      [target.id, target],
    ]);
    return relationshipGeometry(relationship, lookup);
  }, [relationship, source, target]);

  if (!relationship || !geometry) return null;

  const markers = [
    crowFootGlyph(
      geometry.sourceAnchor,
      geometry.sourceSide,
      geometry.sourceKind,
      relationship.sourceOptional,
    ),
    crowFootGlyph(
      geometry.targetAnchor,
      geometry.targetSide,
      geometry.targetKind,
      relationship.targetOptional,
    ),
  ];

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    canvasRef.current?.focus({ preventScroll: true });
    engine.select("relationship", id, e.shiftKey || e.metaKey || e.ctrlKey);
  };

  return (
    <g
      className={cx(
        "wpn-erd-edge",
        selected && "wpn-erd-edge--selected",
        issue && `wpn-erd-edge--issue-${issue}`,
        aiMarkClass(aiMark),
      )}
      data-relationship-id={id}
    >
      <path className="wpn-erd-edge__hit" d={geometry.path} onPointerDown={onPointerDown} />
      <path className="wpn-erd-edge__line" d={geometry.path} />
      {markers.map((d, index) => (
        <path key={index} className="wpn-erd-edge__marker" d={d} />
      ))}
      {relationship.name && (
        <text className="wpn-erd-edge__label" x={geometry.labelX} y={geometry.labelY - 6}>
          {relationship.name}
        </text>
      )}
    </g>
  );
});

const ConnectionLine = memo(function ConnectionLine() {
  const connection = useErdState((s) => s.connection);
  const fromEntity = useErdState((s) =>
    s.connection ? s.entityLookup.get(s.connection.fromEntityId) : undefined,
  );
  const candidateEntity = useErdState((s) =>
    s.connection?.candidate ? s.entityLookup.get(s.connection.candidate) : undefined,
  );
  if (!connection || !fromEntity) return null;

  const fromRect = getEntityRect(fromEntity);
  let startSide: ErdSide =
    connection.pointer.x >= fromRect.x + fromRect.width / 2 ? "right" : "left";
  let end: XYPosition = connection.pointer;
  let endSide: ErdSide = OPPOSITE_SIDE[startSide];
  if (connection.candidate && candidateEntity) {
    const sides = chooseSides(fromRect, getEntityRect(candidateEntity));
    startSide = sides.sourceSide;
    endSide = sides.targetSide;
    end = entityAnchor(candidateEntity, endSide);
  }
  const start = entityAnchor(fromEntity, startSide);
  const { path } = getEdgePath("step", {
    source: start,
    sourceSide: startSide,
    target: end,
    targetSide: endSide,
  });

  const state = connection.candidate
    ? connection.valid
      ? "wpn-erd-edge__connection--valid"
      : "wpn-erd-edge__connection--invalid"
    : undefined;
  return (
    <g className={cx("wpn-erd-edge__connection", state)}>
      <path d={path} />
      <circle cx={end.x} cy={end.y} r={CONNECTION_ENDPOINT_RADIUS} />
    </g>
  );
});

export const ErdEdgeLayer = memo(function ErdEdgeLayer() {
  const ids = useErdState((s) => s.relationships.map((rel) => rel.id), shallowEqual);
  const connecting = useErdState((s) => s.connection !== null);
  return (
    <svg className={cx("wpn-erd-edge__layer", connecting && "wpn-erd-edge__layer--connecting")}>
      {ids.map((id) => (
        <RelationshipEdge key={id} id={id} />
      ))}
      <ConnectionLine />
    </svg>
  );
});

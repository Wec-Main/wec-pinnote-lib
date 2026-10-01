import { memo, type CSSProperties } from "react";
import { useErdEngine, useErdState } from "../../../context/ErdContext";
import { useEntityConnectionDrag } from "../../../hooks/erd/useEntityConnectionDrag";
import { useErdNodeDrag } from "../../../hooks/erd/useErdNodeDrag";
import {
  ENTITY_BODY_PADDING,
  ENTITY_DEFAULT_WIDTH,
  ENTITY_HEADER_HEIGHT,
  FIELD_ROW_HEIGHT,
} from "../../../utils/erd/erdConstants";
import { entityHeight, type ErdSide } from "../../../utils/erd/erdGeometry";
import { cx } from "../../../utils/flowchart/shallow";
import { Icon } from "../../WecFlow/FlowIcons";
import { FieldRow } from "./FieldRow";

type ConnectionStatus = "idle" | "source" | "connectable" | "valid" | "invalid";

const SIDES: readonly ErdSide[] = ["left", "right"];

const EntityHandle = memo(function EntityHandle({ id, side }: { id: string; side: ErdSide }) {
  const onPointerDown = useEntityConnectionDrag(id);
  return (
    <span
      className={cx("wpn-erd-entity__handle", `wpn-erd-entity__handle--${side}`)}
      data-entity-id={id}
      data-side={side}
      onPointerDown={onPointerDown}
    />
  );
});

export const EntityNode = memo(function EntityNode({ id }: { id: string }) {
  const engine = useErdEngine();
  const entity = useErdState((s) => s.entityLookup.get(id));
  const selected = useErdState((s) => s.selection.entityIds.has(id));
  const issue = useErdState((s) => s.issueEntityIds.get(id));
  const connectionStatus = useErdState((s): ConnectionStatus => {
    const connection = s.connection;
    if (!connection) return "idle";
    if (connection.fromEntityId === id) return "source";
    if (connection.candidate === id) return connection.valid ? "valid" : "invalid";
    return "connectable";
  });
  const onPointerDown = useErdNodeDrag(id, "entity");
  if (!entity) return null;

  const style = {
    left: entity.position.x,
    top: entity.position.y,
    width: entity.width ?? ENTITY_DEFAULT_WIDTH,
    height: entityHeight(entity),
    "--erd-header-height": `${ENTITY_HEADER_HEIGHT}px`,
    "--erd-row-height": `${FIELD_ROW_HEIGHT}px`,
    "--erd-body-padding": `${ENTITY_BODY_PADDING}px`,
  } as CSSProperties;

  return (
    <div
      className={cx(
        "wpn-erd-entity",
        selected && "wpn-erd-entity--selected",
        entity.collapsed && "wpn-erd-entity--collapsed",
        issue && `wpn-erd-entity--issue-${issue}`,
        connectionStatus !== "idle" && `wpn-erd-entity--connection-${connectionStatus}`,
      )}
      style={style}
      data-entity-id={id}
      onPointerDown={onPointerDown}
    >
      {SIDES.map((side) => (
        <EntityHandle key={side} id={id} side={side} />
      ))}
      <div className="wpn-erd-entity__header">
        <button
          type="button"
          className="wpn-erd-entity__toggle"
          title={entity.collapsed ? "Expand" : "Collapse"}
          aria-label={entity.collapsed ? "Expand entity" : "Collapse entity"}
          aria-expanded={!entity.collapsed}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            if (!engine.getState().readOnly) {
              engine.updateEntity(id, { collapsed: !entity.collapsed });
            }
          }}
        >
          <Icon name="chevron" size={12} />
        </button>
        {entity.schema && entity.schema !== "public" && (
          <span className="wpn-erd-entity__schema" title={entity.schema}>
            {entity.schema}
          </span>
        )}
        <span className="wpn-erd-entity__name" title={entity.name}>
          {entity.name}
        </span>
        <span className="wpn-erd-entity__count">{entity.fields.length}</span>
      </div>
      {!entity.collapsed && (
        <div className="wpn-erd-entity__body">
          {entity.fields.map((field) => (
            <FieldRow key={field.id} entityId={id} field={field} />
          ))}
        </div>
      )}
    </div>
  );
});

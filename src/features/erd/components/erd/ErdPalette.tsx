import { memo, useState, type CSSProperties, type DragEvent } from "react";
import { useErdEngine, useErdState } from "../../ErdContext";
import {
  ENTITY_DEFAULT_WIDTH,
  ERD_PALETTE_DRAG_MIME,
  NOTE_DEFAULT_SIZE,
} from "../../../../utils/erd/erdConstants";
import type { ErdEngine } from "../../../../utils/erd/erdEngine";
import { cx } from "../../../../utils/flowchart/shallow";
import { Icon } from "../../../flowchart/components/FlowIcons";

const ENTITY_PLACEMENT_HEIGHT = 80;
const JITTER_STEP = 24;
const JITTER_CYCLE = 5;

function viewportCenter(
  engine: ErdEngine,
  itemCount: number,
  size: { width: number; height: number },
) {
  const { viewport, canvasSize } = engine.getState();
  const jitter = (itemCount % JITTER_CYCLE) * JITTER_STEP;
  return {
    x: (canvasSize.width / 2 - viewport.x) / viewport.zoom - size.width / 2 + jitter,
    y: (canvasSize.height / 2 - viewport.y) / viewport.zoom - size.height / 2 + jitter,
  };
}

type PaletteKind = "entity" | "note";
type OutlineKind = "entity" | "enum" | "note";

const FOCUS_OPTIONS = { padding: 0.4, maxZoom: 1 };

export const ErdPalette = memo(function ErdPalette({ style }: { style?: CSSProperties }) {
  const engine = useErdEngine();
  const readOnly = useErdState((s) => s.readOnly);
  const entities = useErdState((s) => s.entities);
  const relationships = useErdState((s) => s.relationships);
  const enums = useErdState((s) => s.enums);
  const notes = useErdState((s) => s.notes);
  const selection = useErdState((s) => s.selection);
  const [query, setQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(new Set());

  const addEntity = () => {
    const position = viewportCenter(engine, engine.getState().entities.length, {
      width: ENTITY_DEFAULT_WIDTH,
      height: ENTITY_PLACEMENT_HEIGHT,
    });
    engine.select("entity", engine.addEntity({ position }).id);
  };
  const addNote = () => {
    const position = viewportCenter(engine, engine.getState().notes.length, NOTE_DEFAULT_SIZE);
    engine.select("note", engine.addNote({ position }).id);
  };

  const addEnum = () => {
    engine.select("enum", engine.addEnum().id);
  };

  const outlineGroups: {
    kind: OutlineKind;
    title: string;
    icon: "database" | "puzzle" | "textShape";
    items: { id: string; label: string }[];
  }[] = [
    {
      kind: "enum",
      title: "Enums",
      icon: "puzzle",
      items: enums.map((entry) => ({ id: entry.id, label: entry.name })),
    },
    {
      kind: "note",
      title: "Notes",
      icon: "textShape",
      items: notes.map((note, index) => ({
        id: note.id,
        label: note.text.trim().split("\n")[0]?.slice(0, 40) || `Note ${index + 1}`,
      })),
    },
  ];
  const needle = query.trim().toLowerCase();
  const total = entities.length + enums.length + notes.length;

  const entityItems = entities.map((entity) => ({
    id: entity.id,
    label: entity.name,
    color: entity.color,
    fieldCount: entity.fields.length,
    relCount: relationships.filter(
      (rel) => rel.sourceEntityId === entity.id || rel.targetEntityId === entity.id,
    ).length,
    group: entity.group?.trim() || "",
  }));
  const entityGroupMap = new Map<string, typeof entityItems>();
  for (const item of entityItems) {
    const list = entityGroupMap.get(item.group) ?? [];
    list.push(item);
    entityGroupMap.set(item.group, list);
  }
  const namedEntityGroups = [...entityGroupMap.entries()]
    .filter(([key]) => key !== "")
    .sort((a, b) => a[0].localeCompare(b[0]));
  const ungroupedEntities = entityGroupMap.get("");
  const entityGroups = ungroupedEntities
    ? [...namedEntityGroups, ["Ungrouped", ungroupedEntities] as const]
    : namedEntityGroups;

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  };

  const isSelected = (kind: OutlineKind, id: string) =>
    kind === "entity"
      ? selection.entityIds.has(id)
      : kind === "note"
        ? selection.noteIds.has(id)
        : selection.enumId === id;

  const focusItem = (kind: OutlineKind, id: string) => {
    engine.select(kind, id);
    if (kind !== "enum") engine.fitView({ ids: [id], ...FOCUS_OPTIONS });
  };

  const dragStart = (kind: PaletteKind) => (event: DragEvent) => {
    event.dataTransfer.setData(ERD_PALETTE_DRAG_MIME, kind);
    event.dataTransfer.effectAllowed = "copy";
  };

  const draggableItem = (
    kind: PaletteKind,
    label: string,
    icon: "database" | "puzzle" | "textShape",
    add: () => void,
  ) => (
    <button
      type="button"
      className={cx(
        "wpn-flowchart-sidebar__item",
        readOnly && "wpn-flowchart-sidebar__item-disabled",
      )}
      draggable={!readOnly}
      disabled={readOnly}
      title={
        readOnly ? "Read-only mode" : `Drag onto the canvas or click to add ${label.toLowerCase()}`
      }
      onDragStart={dragStart(kind)}
      onClick={add}
    >
      <span className="wpn-erd__palette-icon" aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      <span className="wpn-flowchart-sidebar__item-text">
        <span className="wpn-flowchart-sidebar__item-label">{label}</span>
      </span>
      <span className="wpn-flowchart-sidebar__grip" aria-hidden="true">
        ⋮⋮
      </span>
    </button>
  );

  return (
    <aside className="wpn-flowchart-sidebar__sidebar wpn-erd__palette" style={style}>
      <div className="wpn-flowchart-sidebar__list">
        <div className="wpn-flowchart-sidebar__group wpn-erd__palette-group">
          <div className="wpn-flowchart-ui__section-title">Add</div>
          {draggableItem("entity", "Entity", "database", addEntity)}
          {draggableItem("note", "Note", "textShape", addNote)}
          {!readOnly && (
            <button
              type="button"
              className="wpn-flowchart-sidebar__item"
              title="Add an enum type"
              onClick={addEnum}
            >
              <span className="wpn-erd__palette-icon" aria-hidden="true">
                <Icon name="puzzle" size={18} />
              </span>
              <span className="wpn-flowchart-sidebar__item-text">
                <span className="wpn-flowchart-sidebar__item-label">Enum</span>
              </span>
            </button>
          )}
        </div>
        {total > 0 && (
          <div className="wpn-flowchart-sidebar__group wpn-erd__outline">
            <div className="wpn-flowchart-ui__section-title">In this model ({total})</div>
            {total > 6 && (
              <input
                type="search"
                className="wpn-flowchart-ui__input wpn-erd__outline-search"
                placeholder="Search…"
                aria-label="Search model objects"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            )}
            {entities.length > 0 && (
              <div className="wpn-erd__outline-group">
                <div className="wpn-erd__outline-title">Entities ({entities.length})</div>
                {entityGroups.map(([groupName, items]) => {
                  const filtered = items.filter(
                    (item) => !needle || item.label.toLowerCase().includes(needle),
                  );
                  if (filtered.length === 0) return null;
                  const collapsed = collapsedGroups.has(groupName);
                  return (
                    <div key={groupName} className="wpn-erd__outline-subgroup">
                      <button
                        type="button"
                        className="wpn-erd__outline-subgroup-toggle"
                        aria-expanded={!collapsed}
                        onClick={() => toggleGroup(groupName)}
                      >
                        <Icon
                          name="chevron"
                          size={12}
                          className={cx("wpn-erd__chevron", !collapsed && "wpn-erd__chevron-open")}
                        />
                        <span>{groupName || "Ungrouped"}</span>
                        <span className="wpn-erd__outline-subgroup-count">({filtered.length})</span>
                      </button>
                      {!collapsed &&
                        filtered.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className={cx(
                              "wpn-erd__outline-item",
                              isSelected("entity", item.id) && "wpn-erd__outline-item--active",
                            )}
                            aria-pressed={isSelected("entity", item.id)}
                            onClick={() => focusItem("entity", item.id)}
                          >
                            <Icon name="database" size={14} />
                            <span
                              className="wpn-erd__outline-color-dot"
                              style={{ backgroundColor: item.color ?? "transparent" }}
                              aria-hidden="true"
                            />
                            <span className="wpn-erd__outline-label">
                              {item.label || "Untitled"}
                            </span>
                            <span className="wpn-erd__outline-badge">
                              {item.fieldCount}f · {item.relCount}r
                            </span>
                          </button>
                        ))}
                    </div>
                  );
                })}
              </div>
            )}
            {outlineGroups.map((group) => {
              const items = group.items.filter(
                (item) => !needle || item.label.toLowerCase().includes(needle),
              );
              if (items.length === 0) return null;
              return (
                <div key={group.kind} className="wpn-erd__outline-group">
                  <div className="wpn-erd__outline-title">
                    {group.title} ({items.length})
                  </div>
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={cx(
                        "wpn-erd__outline-item",
                        isSelected(group.kind, item.id) && "wpn-erd__outline-item--active",
                      )}
                      aria-pressed={isSelected(group.kind, item.id)}
                      onClick={() => focusItem(group.kind, item.id)}
                    >
                      <Icon name={group.icon} size={14} />
                      <span className="wpn-erd__outline-label">{item.label || "Untitled"}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
});

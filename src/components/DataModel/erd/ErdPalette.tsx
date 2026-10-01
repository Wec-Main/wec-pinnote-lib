import { memo, type CSSProperties, type DragEvent } from "react";
import { useErdEngine, useErdState } from "../../../context/ErdContext";
import {
  ENTITY_DEFAULT_WIDTH,
  ERD_PALETTE_DRAG_MIME,
  NOTE_DEFAULT_SIZE,
} from "../../../utils/erd/erdConstants";
import type { ErdEngine } from "../../../utils/erd/erdEngine";
import { cx } from "../../../utils/flowchart/shallow";
import { Icon } from "../../WecFlow/FlowIcons";

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

export const ErdPalette = memo(function ErdPalette({ style }: { style?: CSSProperties }) {
  const engine = useErdEngine();
  const readOnly = useErdState((s) => s.readOnly);

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

  const dragStart = (kind: PaletteKind) => (event: DragEvent) => {
    event.dataTransfer.setData(ERD_PALETTE_DRAG_MIME, kind);
    event.dataTransfer.effectAllowed = "copy";
  };

  const draggableItem = (
    kind: PaletteKind,
    label: string,
    icon: "database" | "textShape",
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
        </div>
      </div>
    </aside>
  );
});

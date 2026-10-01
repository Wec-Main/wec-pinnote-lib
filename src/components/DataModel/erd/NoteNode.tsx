import { memo, type CSSProperties } from "react";
import { useErdEngine, useErdState } from "../../../context/ErdContext";
import { useErdEditSession } from "../../../hooks/erd/useErdEditSession";
import { useErdNodeDrag } from "../../../hooks/erd/useErdNodeDrag";
import { useNoteResize } from "../../../hooks/erd/useNoteResize";
import { cx } from "../../../utils/flowchart/shallow";

export const NoteNode = memo(function NoteNode({ id }: { id: string }) {
  const engine = useErdEngine();
  const note = useErdState((s) => s.noteLookup.get(id));
  const selected = useErdState((s) => s.selection.noteIds.has(id));
  const readOnly = useErdState((s) => s.readOnly);
  const onDragPointerDown = useErdNodeDrag(id, "note");
  const onResizePointerDown = useNoteResize(id);
  const editSession = useErdEditSession();
  if (!note) return null;

  const style = {
    left: note.position.x,
    top: note.position.y,
    width: note.width,
    height: note.height,
    ...(note.color ? { "--erd-note-color": note.color } : {}),
  } as CSSProperties;

  return (
    <div
      className={cx("wpn-erd-note", selected && "wpn-erd-note--selected")}
      style={style}
      data-note-id={id}
    >
      <div className="wpn-erd-note__grip" onPointerDown={onDragPointerDown} />
      <textarea
        className="wpn-erd-note__text"
        value={note.text}
        placeholder="Note"
        readOnly={readOnly}
        onPointerDown={(e) => {
          e.stopPropagation();
          engine.select("note", id);
        }}
        onFocus={editSession.onFocus}
        onBlur={editSession.onBlur}
        onChange={(e) => engine.updateNote(id, { text: e.target.value })}
      />
      {!readOnly && <span className="wpn-erd-note__resize" onPointerDown={onResizePointerDown} />}
    </div>
  );
});

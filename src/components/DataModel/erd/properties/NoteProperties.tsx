import { useErdEngine, useErdState } from "../../../../context/ErdContext";
import { useErdEditSession } from "../../../../hooks/erd/useErdEditSession";
import { ColorPicker } from "../../../primitives";
import { Icon } from "../../../WecFlow/FlowIcons";
import { PanelHeader } from "./PanelParts";

export function NoteProperties({ noteId }: { noteId: string }) {
  const engine = useErdEngine();
  const session = useErdEditSession();
  const note = useErdState((s) => s.noteLookup.get(noteId));
  const readOnly = useErdState((s) => s.readOnly);
  if (!note) return <p className="wpn-flowchart-ui__muted">This note no longer exists.</p>;
  return (
    <>
      <PanelHeader title="Note" icon={<Icon name="file" size={14} />} />
      <section className="wpn-flowchart-ui__section">
        <label className="wpn-flowchart-ui__field">
          <span className="wpn-flowchart-ui__field-label">Text</span>
          <textarea
            className="wpn-flowchart-ui__input wpn-erd__textarea"
            value={note.text}
            disabled={readOnly}
            onChange={(e) => engine.updateNote(noteId, { text: e.target.value })}
            {...session}
          />
        </label>
        <div className="wpn-flowchart-ui__field">
          <span className="wpn-flowchart-ui__field-label">Color</span>
          <ColorPicker
            ariaLabel="Note color"
            value={note.color ?? null}
            allowNone
            onChange={(color) => engine.updateNote(noteId, { color: color ?? undefined })}
          />
        </div>
      </section>
      {!readOnly && (
        <section className="wpn-flowchart-ui__section wpn-flowchart-properties__actions">
          <button
            type="button"
            className="wpn-flowchart-ui__btn wpn-flowchart-ui__btn-danger wpn-flowchart-ui__block"
            onClick={() => engine.removeNotes([noteId])}
          >
            <Icon name="trash" size={14} /> Delete note
          </button>
        </section>
      )}
    </>
  );
}

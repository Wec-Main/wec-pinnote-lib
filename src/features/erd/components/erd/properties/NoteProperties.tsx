import type { CSSProperties } from "react";
import { useErdEngine, useErdState } from "../../../ErdContext";
import { useErdEditSession } from "../../../../../hooks/useErdEditSession";
import { ColorPicker } from "../../../../../components/primitives/ColorPicker";
import { Icon } from "../../../../flowchart/components/FlowIcons";
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
          <span className="wpn-flowchart-ui__field-label">Colors</span>
          <div className="wpn-erd-color-row">
            <div
              className="wpn-erd-note-color-preview"
              aria-hidden="true"
              style={
                {
                  "--erd-note-color": note.color || "#f59e0b",
                  ...(note.titleColor ? { "--erd-note-title-color": note.titleColor } : {}),
                } as CSSProperties
              }
            >
              <div className="wpn-erd-note-color-preview__grip" />
              <div className="wpn-erd-note-color-preview__body" />
            </div>
            <div className="wpn-erd-color-row__pickers">
              <div className="wpn-erd-color-row__picker">
                <span className="wpn-erd-color-row__picker-label">Fill</span>
                <ColorPicker
                  ariaLabel="Note fill color"
                  value={note.color ?? null}
                  allowNone
                  showValue
                  onChange={(color) => engine.updateNote(noteId, { color: color ?? undefined })}
                />
              </div>
              <div className="wpn-erd-color-row__picker">
                <span className="wpn-erd-color-row__picker-label">Title</span>
                <ColorPicker
                  ariaLabel="Note title color"
                  value={note.titleColor ?? null}
                  allowNone
                  showValue
                  onChange={(color) =>
                    engine.updateNote(noteId, { titleColor: color ?? undefined })
                  }
                />
              </div>
            </div>
          </div>
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

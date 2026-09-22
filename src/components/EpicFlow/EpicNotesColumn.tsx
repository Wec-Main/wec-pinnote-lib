import type { EpicNote } from "../../types/epicFlow.types";
import { formatTimestamp } from "../../utils/format";
import { parseRichText } from "../../utils/richText";

interface EpicNotesColumnProps {
  notes: EpicNote[];
  epicSelected: boolean;
  onCreate: () => void;
}

export function EpicNotesColumn({ notes, epicSelected, onCreate }: EpicNotesColumnProps) {
  return (
    <div className="wpn-epicflow-column">
      <div className="wpn-epicflow-column__header">
        <span className="wpn-epicflow-column__title">
          Epic Notes
          <span className="wpn-epicflow-column__count">{notes.length}</span>
        </span>
        <button
          type="button"
          className="wpn-epicflow-column__add"
          aria-label="Create note"
          disabled={!epicSelected}
          onClick={onCreate}
        >
          <svg viewBox="0 0 24 24" className="wpn-epicflow-column__add-icon" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
              d="M12 5v14M5 12h14"
            />
          </svg>
        </button>
      </div>
      <div className="wpn-epicflow-column__body">
        {!epicSelected ? (
          <p className="wpn-epicflow-empty">Select an Epic to view Epic Notes</p>
        ) : notes.length === 0 ? (
          <p className="wpn-epicflow-empty">No notes match your search.</p>
        ) : (
          notes.map((note) => (
            <article key={note.id} className="wpn-epicflow-card wpn-epicflow-card--static">
              <span className="wpn-epicflow-card__title">{note.title}</span>
              <span className="wpn-epicflow-card__desc">{parseRichText(note.content)}</span>
              <span className="wpn-epicflow-card__meta">
                {note.createdBy} · {formatTimestamp(note.createdAt)}
              </span>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

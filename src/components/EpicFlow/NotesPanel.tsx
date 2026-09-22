import type { Epic, UserStory } from "../../types/epicFlow.types";

export type NotesPanelTarget = { type: "epic"; epic: Epic } | { type: "userStory"; story: UserStory };

interface NotesPanelProps {
  target: NotesPanelTarget | null;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function NotesPanel({ target, expanded, onToggleExpand, onEdit, onDelete }: NotesPanelProps) {
  const title = target ? (target.type === "epic" ? target.epic.title : target.story.title) : "";
  const description = target ? (target.type === "epic" ? target.epic.description : target.story.description) : "";

  return (
    <div className="wpn-epicflow-column">
      <div className="wpn-epicflow-column__header">
        <span className="wpn-epicflow-column__title">Notes</span>
        <div className="wpn-epicflow-column__header-actions">
          <button
            type="button"
            className="wpn-epicflow-column__icon-btn"
            aria-label={target?.type === "epic" ? "Edit epic" : "Edit user story"}
            disabled={!target}
            onClick={onEdit}
          >
            <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
              />
            </svg>
          </button>
          <button
            type="button"
            className="wpn-epicflow-column__icon-btn wpn-epicflow-column__icon-btn--danger"
            aria-label={target?.type === "epic" ? "Delete epic" : "Delete user story"}
            disabled={!target}
            onClick={onDelete}
          >
            <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z"
              />
            </svg>
          </button>
          <button
            type="button"
            className="wpn-epicflow-column__icon-btn"
            aria-label={expanded ? "Collapse Notes" : "Expand Notes"}
            onClick={onToggleExpand}
          >
            {expanded ? (
              <svg viewBox="0 0 24 24" className="wpn-epicflow-column__expand-icon" aria-hidden="true">
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d="M4 10V5h5M4 14v5h5M20 10V5h-5M20 14v5h-5"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="wpn-epicflow-column__expand-icon" aria-hidden="true">
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
      <div className="wpn-epicflow-column__body">
        {!target ? (
          <p className="wpn-epicflow-empty">Select an Epic to view User Stories and Notes</p>
        ) : (
          <div className="wpn-epicflow-detail">
            <span className="wpn-epicflow-detail__title">{title}</span>
            <span className="wpn-epicflow-detail__desc">{description}</span>
          </div>
        )}
      </div>
    </div>
  );
}

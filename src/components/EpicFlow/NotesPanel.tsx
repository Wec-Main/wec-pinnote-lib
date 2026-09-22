import { Icon, Tooltip } from "../primitives";
import type { Epic, UserStory } from "../../types/epicFlow.types";

export type NotesPanelTarget =
  { type: "epic"; epic: Epic } | { type: "userStory"; story: UserStory };

interface NotesPanelProps {
  target: NotesPanelTarget | null;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function NotesPanel({
  target,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
}: NotesPanelProps) {
  const title = target ? (target.type === "epic" ? target.epic.title : target.story.title) : "";
  const description = target
    ? target.type === "epic"
      ? target.epic.description
      : target.story.description
    : "";

  return (
    <div className="wpn-epicflow-column">
      <div className="wpn-epicflow-column__header wpn-epicflow-column__header--notes">
        <span className="wpn-epicflow-column__title">
          <span className="wpn-epicflow-column__badge wpn-epicflow-column__badge--notes">
            <Icon name="comment" />
          </span>
          Notes
        </span>
        <div className="wpn-epicflow-column__header-actions">
          <Tooltip
            label={target?.type === "epic" ? "Edit epic" : "Edit user story"}
            placement="bottom"
          >
            <button
              type="button"
              className="wpn-epicflow-column__icon-btn"
              aria-label={target?.type === "epic" ? "Edit epic" : "Edit user story"}
              disabled={!target}
              onClick={onEdit}
            >
              <Icon name="edit" />
            </button>
          </Tooltip>
          <Tooltip
            label={target?.type === "epic" ? "Delete epic" : "Delete user story"}
            placement="bottom"
          >
            <button
              type="button"
              className="wpn-epicflow-column__icon-btn wpn-epicflow-column__icon-btn--danger"
              aria-label={target?.type === "epic" ? "Delete epic" : "Delete user story"}
              disabled={!target}
              onClick={onDelete}
            >
              <Icon name="trash" />
            </button>
          </Tooltip>
          <Tooltip label={expanded ? "Collapse notes" : "Expand notes"} placement="bottom">
            <button
              type="button"
              className="wpn-epicflow-column__icon-btn"
              aria-label={expanded ? "Collapse notes" : "Expand notes"}
              aria-pressed={expanded}
              onClick={onToggleExpand}
            >
              <Icon
                name={expanded ? "collapse" : "expand"}
                className="wpn-epicflow-column__expand-icon"
              />
            </button>
          </Tooltip>
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

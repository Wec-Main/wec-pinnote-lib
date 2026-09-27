import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon, Tooltip } from "../primitives";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import type { Epic, UserStory } from "../../types/epicFlow.types";

export type NotesPanelTarget =
  { type: "epic"; epic: Epic } | { type: "userStory"; story: UserStory };

export type NotesPanelSubmit = (data: { title: string; description: string }) => void;

const NOTES_TITLE_MAX = 100;
const NOTES_DESCRIPTION_MAX = 500;

interface NotesPanelProps {
  target: NotesPanelTarget | null;
  expanded: boolean;
  busy: boolean;
  onToggleExpand: () => void;
  onSubmit: NotesPanelSubmit;
  onDelete: () => void;
}

export function NotesPanel({
  target,
  expanded,
  busy,
  onToggleExpand,
  onSubmit,
  onDelete,
}: NotesPanelProps) {
  const title = target ? (target.type === "epic" ? target.epic.title : target.story.title) : "";
  const description = target
    ? target.type === "epic"
      ? target.epic.description
      : target.story.description
    : "";
  const targetKey = target
    ? target.type === "epic"
      ? `epic:${target.epic.id}`
      : `userStory:${target.story.id}`
    : "";

  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [descriptionDraft, setDescriptionDraft] = useState(description);
  const [touched, setTouched] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const editingKeyRef = useRef(targetKey);

  useEffect(() => {
    if (editingKeyRef.current !== targetKey) {
      editingKeyRef.current = targetKey;
      setEditing(false);
      setTouched(false);
    }
  }, [targetKey]);

  useEffect(() => {
    if (editing) {
      setTitleDraft(title);
      setDescriptionDraft(description);
      setTouched(false);
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editing, title, description]);

  const cancelEdit = () => {
    setTitleDraft(title);
    setDescriptionDraft(description);
    setTouched(false);
    setEditing(false);
  };

  useEscapeKey(cancelEdit, editing);

  const trimmedTitleDraft = titleDraft.trim();
  const trimmedDescriptionDraft = descriptionDraft.trim();
  const titleDraftValid = trimmedTitleDraft.length > 0;
  const descriptionDraftValid = trimmedDescriptionDraft.length > 0;

  const commitEdit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!titleDraftValid || !descriptionDraftValid || busy) {
      return;
    }
    onSubmit({ title: trimmedTitleDraft, description: trimmedDescriptionDraft });
    setEditing(false);
  };

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
          {editing ? (
            <>
              <Tooltip label="Cancel edit" placement="bottom">
                <button
                  type="button"
                  className="wpn-epicflow-column__icon-btn"
                  aria-label="Cancel edit"
                  disabled={busy}
                  onClick={cancelEdit}
                >
                  <Icon name="close" />
                </button>
              </Tooltip>
              <Tooltip label="Save changes" placement="bottom">
                <button
                  type="button"
                  className="wpn-epicflow-column__icon-btn"
                  aria-label="Save changes"
                  disabled={busy}
                  onClick={commitEdit}
                >
                  <Icon name="check" />
                </button>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip
                label={target?.type === "epic" ? "Edit epic" : "Edit user story"}
                placement="bottom"
              >
                <button
                  type="button"
                  className="wpn-epicflow-column__icon-btn"
                  aria-label={target?.type === "epic" ? "Edit epic" : "Edit user story"}
                  disabled={!target}
                  onClick={() => setEditing(true)}
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
            </>
          )}
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
        ) : editing ? (
          <form className="wpn-epicflow-detail wpn-epicflow-detail--editing" onSubmit={commitEdit}>
            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">
                Title <span className="wpn-epicflow-modal__required">*</span>
              </span>
              <input
                ref={titleInputRef}
                className="wpn-epicflow-modal__input"
                value={titleDraft}
                maxLength={NOTES_TITLE_MAX}
                disabled={busy}
                onChange={(event) => setTitleDraft(event.target.value)}
              />
              {touched && !titleDraftValid ? (
                <span className="wpn-users-modal__error">A title is required.</span>
              ) : null}
            </label>
            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">
                Notes <span className="wpn-epicflow-modal__required">*</span>
              </span>
              <textarea
                className="wpn-epicflow-modal__input wpn-epicflow-modal__textarea"
                value={descriptionDraft}
                maxLength={NOTES_DESCRIPTION_MAX}
                rows={4}
                disabled={busy}
                onChange={(event) => setDescriptionDraft(event.target.value)}
              />
              {touched && !descriptionDraftValid ? (
                <span className="wpn-users-modal__error">Notes are required.</span>
              ) : null}
            </label>
          </form>
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

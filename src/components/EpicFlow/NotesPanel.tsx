import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon, Tooltip } from "../primitives";
import { AuthorBadge } from "./AuthorBadge";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { formatTimestamp } from "../../utils/format";
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
  const record = target ? (target.type === "epic" ? target.epic : target.story) : null;

  const [editing, setEditing] = useState(false);
  const [showMeta, setShowMeta] = useState(false);
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
      setShowMeta(false);
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

  const targetKindLabel = target ? (target.type === "epic" ? "Epic" : "User Stories") : "";
  const headerBreadcrumb = target ? `Notes: ${targetKindLabel} → ${title}` : "Notes";

  const actions = (
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
          <Tooltip label={showMeta ? "Hide details" : "Show details"} placement="bottom">
            <button
              type="button"
              className="wpn-epicflow-column__icon-btn"
              aria-label={showMeta ? "Hide details" : "Show details"}
              aria-pressed={showMeta}
              disabled={!target}
              onClick={() => setShowMeta((current) => !current)}
            >
              <Icon name="info" />
            </button>
          </Tooltip>
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
  );

  return (
    <div className="wpn-epicflow-column">
      <div className="wpn-epicflow-column__header wpn-epicflow-column__header--notes">
        <span className="wpn-epicflow-column__title wpn-epicflow-column__title--breadcrumb">
          {headerBreadcrumb}
        </span>
      </div>
      <div className="wpn-epicflow-column__body">
        {!target ? (
          <p className="wpn-epicflow-empty">Select an Epic to view User Stories and Notes</p>
        ) : editing ? (
          <form className="wpn-epicflow-detail wpn-epicflow-detail--editing" onSubmit={commitEdit}>
            <div className="wpn-epicflow-detail__row">
              <span className="wpn-epicflow-detail__title">{title}</span>
              {actions}
            </div>
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
            <div className="wpn-epicflow-detail__row">
              <span className="wpn-epicflow-detail__title">{title}</span>
              {actions}
            </div>
            {showMeta && record ? (
              <div className="wpn-epicflow-detail__meta">
                <div className="wpn-epicflow-detail__meta-col">
                  <div className="wpn-epicflow-detail__meta-item">
                    <span className="wpn-epicflow-detail__meta-label">Created by</span>
                    <AuthorBadge
                      name={record.createdByUser}
                      tooltipLabel={`Created by ${record.createdByUser}`}
                    />
                  </div>
                  <div className="wpn-epicflow-detail__meta-item">
                    <span className="wpn-epicflow-detail__meta-label">Created at</span>
                    <span className="wpn-epicflow-detail__meta-date">
                      <Icon name="calendar" className="wpn-epicflow-card__stat-icon" />
                      {formatTimestamp(record.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="wpn-epicflow-detail__meta-col">
                  <div className="wpn-epicflow-detail__meta-item">
                    <span className="wpn-epicflow-detail__meta-label">Last updated by</span>
                    <AuthorBadge
                      name={record.updatedByUser ?? record.createdByUser}
                      tooltipLabel={`Last updated by ${record.updatedByUser ?? record.createdByUser}`}
                    />
                  </div>
                  <div className="wpn-epicflow-detail__meta-item">
                    <span className="wpn-epicflow-detail__meta-label">Last updated at</span>
                    <span className="wpn-epicflow-detail__meta-date">
                      <Icon name="calendar" className="wpn-epicflow-card__stat-icon" />
                      {formatTimestamp(record.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
            <span className="wpn-epicflow-detail__desc">{description}</span>
          </div>
        )}
      </div>
    </div>
  );
}

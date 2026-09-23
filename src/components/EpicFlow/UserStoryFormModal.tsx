import { useRef, useState, type FormEvent } from "react";
import { Icon, Spinner, Tooltip } from "../primitives";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useScrimDismiss } from "../../hooks/useScrimDismiss";
import type { Epic, UserStory } from "../../types/epicFlow.types";

const TITLE_MAX = 100;
const DESCRIPTION_MAX = 500;

interface UserStoryFormModalProps {
  mode: "create" | "edit";
  epic: Epic;
  initialStory?: UserStory;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; description: string }) => void;
}

export function UserStoryFormModal({
  mode,
  epic,
  initialStory,
  busy = false,
  onClose,
  onSubmit,
}: UserStoryFormModalProps) {
  const [title, setTitle] = useState(initialStory?.title ?? "");
  const [description, setDescription] = useState(initialStory?.description ?? "");
  const [touched, setTouched] = useState(false);
  const dialogRef = useRef<HTMLFormElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const dismiss = () => {
    if (!busy) {
      onClose();
    }
  };

  useEscapeKey(dismiss);
  useFocusTrap(dialogRef, titleInputRef);
  const scrimProps = useScrimDismiss(dismiss);

  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();
  const titleValid = trimmedTitle.length > 0;
  const descriptionValid = trimmedDescription.length > 0;
  const isEdit = mode === "edit";

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!titleValid || !descriptionValid || busy) {
      return;
    }
    onSubmit({ title: trimmedTitle, description: trimmedDescription });
  };

  return (
    <div className="wpn-epicflow-modal-scrim" {...scrimProps}>
      <form
        ref={dialogRef}
        className="wpn-epicflow-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wpn-story-form-title"
        onSubmit={handleSubmit}
      >
        <div className="wpn-epicflow-modal__header">
          <div>
            <h2 className="wpn-epicflow-modal__title" id="wpn-story-form-title">
              {isEdit ? "Edit user story" : "Create user story"}
            </h2>
            <p className="wpn-epicflow-modal__subtitle">
              {isEdit
                ? "Update the details of this user story."
                : "Add a new user story to this epic."}
            </p>
          </div>
          <Tooltip label="Close" placement="left">
            <button
              type="button"
              className="wpn-icon-btn wpn-icon-btn--danger"
              aria-label={isEdit ? "Close edit user story" : "Close create user story"}
              onClick={onClose}
              disabled={busy}
            >
              <Icon name="close" />
            </button>
          </Tooltip>
        </div>

        <div className="wpn-epicflow-modal__body">
          <div className="wpn-epicflow-modal__fields">
            <div className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">Epic</span>
              <div className="wpn-epicflow-modal__readonly">
                <Icon name="epic" className="wpn-epicflow-modal__readonly-icon" />
                {epic.title}
              </div>
            </div>

            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">
                Title <span className="wpn-epicflow-modal__required">*</span>
              </span>
              <input
                ref={titleInputRef}
                className="wpn-epicflow-modal__input"
                value={title}
                maxLength={TITLE_MAX}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="As a customer, I want..."
              />
              <span className="wpn-epicflow-modal__counter">
                {title.length}/{TITLE_MAX}
              </span>
              {touched && !titleValid ? (
                <span className="wpn-users-modal__error">A title is required.</span>
              ) : null}
            </label>

            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">
                Description <span className="wpn-epicflow-modal__required">*</span>
              </span>
              <textarea
                className="wpn-epicflow-modal__input wpn-epicflow-modal__textarea"
                value={description}
                maxLength={DESCRIPTION_MAX}
                rows={4}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the acceptance criteria or context for this user story..."
              />
              <span className="wpn-epicflow-modal__counter">
                {description.length}/{DESCRIPTION_MAX}
              </span>
              {touched && !descriptionValid ? (
                <span className="wpn-users-modal__error">A description is required.</span>
              ) : null}
            </label>
          </div>
        </div>

        <div className="wpn-epicflow-modal__footer">
          <button
            type="button"
            className="wpn-btn wpn-btn--ghost"
            onClick={onClose}
            disabled={busy}
          >
            <Icon name="close" className="wpn-btn__icon" />
            Cancel
          </button>
          <button type="submit" className="wpn-btn wpn-btn--primary" disabled={busy}>
            {busy ? (
              <Spinner className="wpn-btn__icon" />
            ) : (
              <Icon name={isEdit ? "check" : "plus"} className="wpn-btn__icon" />
            )}
            {isEdit ? "Save changes" : "Create user story"}
          </button>
        </div>
      </form>
    </div>
  );
}

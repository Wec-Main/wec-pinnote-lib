import { useState, type FormEvent } from "react";
import { Icons } from "../../assets/icons";
import type { Epic, UserStory } from "../../types/epicFlow.types";

const TITLE_MAX = 100;
const DESCRIPTION_MAX = 500;

interface UserStoryFormModalProps {
  mode: "create" | "edit";
  epic: Epic;
  initialStory?: UserStory;
  onClose: () => void;
  onSubmit: (data: { title: string; description: string }) => void;
}

export function UserStoryFormModal({ mode, epic, initialStory, onClose, onSubmit }: UserStoryFormModalProps) {
  const [title, setTitle] = useState(initialStory?.title ?? "");
  const [description, setDescription] = useState(initialStory?.description ?? "");
  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();
  const canSubmit = Boolean(trimmedTitle) && Boolean(trimmedDescription);
  const isEdit = mode === "edit";

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit({ title: trimmedTitle, description: trimmedDescription });
  };

  return (
    <div className="wpn-epicflow-modal-scrim" onClick={onClose}>
      <form className="wpn-epicflow-modal" onClick={(event) => event.stopPropagation()} onSubmit={handleSubmit}>
        <div className="wpn-epicflow-modal__header">
          <div>
            <h2 className="wpn-epicflow-modal__title">{isEdit ? "Edit User Story" : "Create User Story"}</h2>
            <p className="wpn-epicflow-modal__subtitle">
              {isEdit ? "Update the details of this user story." : "Add a new user story to this epic."}
            </p>
          </div>
          <button
            type="button"
            className="wpn-icon-btn"
            aria-label={`Close ${isEdit ? "edit" : "create"} user story`}
            onClick={onClose}
          >
            <span
              aria-hidden="true"
              className="wpn-epicflow-panel__close-icon"
              style={{ WebkitMaskImage: `url(${Icons.close})`, maskImage: `url(${Icons.close})` }}
            />
          </button>
        </div>
        <div className="wpn-epicflow-modal__body">
          <div className="wpn-epicflow-modal__fields">
            <div className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">Epic</span>
              <div className="wpn-epicflow-modal__readonly">{epic.title}</div>
            </div>
            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">
                Title <span className="wpn-epicflow-modal__required">*</span>
              </span>
              <input
                className="wpn-epicflow-modal__input"
                value={title}
                maxLength={TITLE_MAX}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="As a customer, I want..."
                autoFocus
              />
              <span className="wpn-epicflow-modal__counter">
                {title.length}/{TITLE_MAX}
              </span>
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
            </label>
          </div>
        </div>
        <div className="wpn-epicflow-modal__footer">
          <button type="button" className="wpn-btn wpn-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="wpn-btn wpn-btn--primary" disabled={!canSubmit}>
            {isEdit ? "Save Changes" : "Create User Story"}
          </button>
        </div>
      </form>
    </div>
  );
}

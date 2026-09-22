import { useState, type FormEvent } from "react";
import { Icon, Spinner, Tooltip } from "../primitives";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useScrimDismiss } from "../../hooks/useScrimDismiss";
import type { Epic } from "../../types/epicFlow.types";

const TITLE_MAX = 100;
const DESCRIPTION_MAX = 500;

interface EpicFormModalProps {
  mode: "create" | "edit";
  initialEpic?: Epic;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; description: string }) => void;
}

export function EpicFormModal({
  mode,
  initialEpic,
  busy = false,
  onClose,
  onSubmit,
}: EpicFormModalProps) {
  const [title, setTitle] = useState(initialEpic?.title ?? "");
  const [description, setDescription] = useState(initialEpic?.description ?? "");
  const [touched, setTouched] = useState(false);

  const dismiss = () => {
    if (!busy) {
      onClose();
    }
  };

  useEscapeKey(dismiss);
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
        className="wpn-epicflow-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wpn-epic-form-title"
        onSubmit={handleSubmit}
      >
        <div className="wpn-epicflow-modal__header">
          <div>
            <h2 className="wpn-epicflow-modal__title" id="wpn-epic-form-title">
              {isEdit ? "Edit epic" : "Create epic"}
            </h2>
            <p className="wpn-epicflow-modal__subtitle">
              {isEdit
                ? "Update the details of this epic."
                : "Define a new epic to group related user stories."}
            </p>
          </div>
          <Tooltip label="Close" placement="left">
            <button
              type="button"
              className="wpn-icon-btn wpn-icon-btn--danger"
              aria-label={isEdit ? "Close edit epic" : "Close create epic"}
              onClick={onClose}
              disabled={busy}
            >
              <Icon name="close" />
            </button>
          </Tooltip>
        </div>

        <div className="wpn-epicflow-modal__body">
          <div className="wpn-epicflow-modal__fields">
            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">
                Epic title <span className="wpn-epicflow-modal__required">*</span>
              </span>
              <input
                className="wpn-epicflow-modal__input"
                value={title}
                maxLength={TITLE_MAX}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. AI-Powered Shopping Experience"
                autoFocus
              />
              <span className="wpn-epicflow-modal__counter">
                {title.length}/{TITLE_MAX}
              </span>
              {touched && !titleValid ? (
                <span className="wpn-users-modal__error">An epic title is required.</span>
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
                placeholder="Describe the goal and scope of this epic..."
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
            {isEdit ? "Save changes" : "Create epic"}
          </button>
        </div>
      </form>
    </div>
  );
}

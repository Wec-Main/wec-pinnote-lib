import { useRef, useState, type FormEvent } from "react";
import { Icon, Spinner, Tooltip } from "../primitives";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useScrimDismiss } from "../../hooks/useScrimDismiss";
import { CharCounterField } from "./CharCounterField";
import type { Epic } from "../../types/epicFlow.types";

const TITLE_MAX = 1000;
const DESCRIPTION_MAX = 35000;

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
            <CharCounterField
              ref={titleInputRef}
              label="Epic title"
              required
              value={title}
              maxLength={TITLE_MAX}
              onChange={setTitle}
              placeholder="e.g. AI-Powered Shopping Experience"
              error={touched && !titleValid ? "An epic title is required." : null}
            />

            <CharCounterField
              label="Notes"
              required
              multiline
              rows={4}
              value={description}
              maxLength={DESCRIPTION_MAX}
              onChange={setDescription}
              placeholder="Describe the goal and scope of this epic..."
              error={touched && !descriptionValid ? "Notes are required." : null}
            />
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

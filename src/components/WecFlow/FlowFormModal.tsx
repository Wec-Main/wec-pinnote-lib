import { useRef, useState, type FormEvent } from "react";
import { Icon, Spinner, Tooltip } from "../primitives";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useScrimDismiss } from "../../hooks/useScrimDismiss";
import type { Flow } from "../../types/flowPin.types";

const NAME_MAX = 200;
const NOTES_MAX = 10000;

interface FlowFormModalProps {
  mode: "create" | "edit";
  initialFlow?: Flow;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description: string }) => void;
}

export function FlowFormModal({
  mode,
  initialFlow,
  busy = false,
  onClose,
  onSubmit,
}: FlowFormModalProps) {
  const [name, setName] = useState(initialFlow?.name ?? "");
  const [notes, setNotes] = useState(initialFlow?.description ?? "");
  const [touched, setTouched] = useState(false);
  const dialogRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const dismiss = () => {
    if (!busy) {
      onClose();
    }
  };

  useEscapeKey(dismiss);
  useFocusTrap(dialogRef, nameInputRef);
  const scrimProps = useScrimDismiss(dismiss);

  const trimmedName = name.trim();
  const nameValid = trimmedName.length > 0;
  const isEdit = mode === "edit";

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!nameValid || busy) {
      return;
    }
    onSubmit({ name: trimmedName, description: notes.trim() });
  };

  return (
    <div className="wpn-epicflow-modal-scrim" {...scrimProps}>
      <form
        ref={dialogRef}
        className="wpn-epicflow-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wpn-flow-form-title"
        onSubmit={handleSubmit}
      >
        <div className="wpn-epicflow-modal__header">
          <div>
            <h2 className="wpn-epicflow-modal__title" id="wpn-flow-form-title">
              {isEdit ? "Edit flow" : "Create flow"}
            </h2>
            <p className="wpn-epicflow-modal__subtitle">
              {isEdit
                ? "Update this flow's name and notes."
                : "Start a new flow chart for this project."}
            </p>
          </div>
          <Tooltip label="Close" placement="left">
            <button
              type="button"
              className="wpn-icon-btn wpn-icon-btn--danger"
              aria-label={isEdit ? "Close edit flow" : "Close create flow"}
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
                Flow name <span className="wpn-epicflow-modal__required">*</span>
              </span>
              <input
                ref={nameInputRef}
                className="wpn-epicflow-modal__input"
                value={name}
                maxLength={NAME_MAX}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Login page flow"
              />
              <span className="wpn-epicflow-modal__counter">
                {name.length}/{NAME_MAX}
              </span>
              {touched && !nameValid ? (
                <span className="wpn-users-modal__error">A flow name is required.</span>
              ) : null}
            </label>

            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">Notes</span>
              <textarea
                className="wpn-epicflow-modal__input wpn-epicflow-modal__textarea"
                value={notes}
                maxLength={NOTES_MAX}
                rows={4}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Notes about this flow as a whole..."
              />
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
            {isEdit ? "Save changes" : "Create flow"}
          </button>
        </div>
      </form>
    </div>
  );
}

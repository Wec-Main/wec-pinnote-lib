import { useRef, useState, type FormEvent } from "react";
import { Icon } from "../../../components/primitives/Icon";
import { Spinner } from "../../../components/primitives/Spinner";
import { Tooltip } from "../../../components/primitives/Tooltip";
import { useEscapeKey } from "../../../hooks/useEscapeKey";
import { useFocusTrap } from "../../../hooks/useFocusTrap";
import { useScrimDismiss } from "../../../hooks/useScrimDismiss";
import type { Flow } from "../../../types/flowPin.types";

const NAME_MAX = 1000;
const WARN_RATIO = 0.9;

interface FlowFormModalProps {
  flow: Flow;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string }) => void;
}

export function FlowFormModal({ flow, busy = false, onClose, onSubmit }: FlowFormModalProps) {
  const [name, setName] = useState(flow.name);
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

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!nameValid || busy) {
      return;
    }
    onSubmit({ name: trimmedName });
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
              Edit flow
            </h2>
            <p className="wpn-epicflow-modal__subtitle">Rename this flow.</p>
          </div>
          <Tooltip label="Close" placement="left">
            <button
              type="button"
              className="wpn-icon-btn wpn-icon-btn--danger"
              aria-label="Close edit flow"
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
              <span
                className={
                  name.length >= NAME_MAX
                    ? "wpn-epicflow-modal__counter wpn-epicflow-modal__counter--limit"
                    : name.length >= NAME_MAX * WARN_RATIO
                      ? "wpn-epicflow-modal__counter wpn-epicflow-modal__counter--warn"
                      : "wpn-epicflow-modal__counter"
                }
              >
                {name.length}/{NAME_MAX}
              </span>
              {touched && !nameValid ? (
                <span className="wpn-users-modal__error">A flow name is required.</span>
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
              <Icon name="check" className="wpn-btn__icon" />
            )}
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}

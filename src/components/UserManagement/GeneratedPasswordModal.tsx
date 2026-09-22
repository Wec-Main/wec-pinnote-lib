import { useId, useRef } from "react";
import { Icon, Tooltip } from "../primitives";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useScrimDismiss } from "../../hooks/useScrimDismiss";
import { useFocusTrap } from "../Settings/useFocusTrap";
import { PasswordField } from "./PasswordField";

interface GeneratedPasswordModalProps {
  title: string;
  description: string;
  password: string;
  onClose: () => void;
}

export function GeneratedPasswordModal({
  title,
  description,
  password,
  onClose,
}: GeneratedPasswordModalProps) {
  useEscapeKey(onClose);
  const scrimProps = useScrimDismiss(onClose);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(dialogRef, closeButtonRef);

  return (
    <div className="wpn-epicflow-modal-scrim" {...scrimProps}>
      <div
        ref={dialogRef}
        className="wpn-epicflow-modal wpn-users-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="wpn-epicflow-modal__header">
          <h2 className="wpn-epicflow-modal__title" id={titleId}>
            {title}
          </h2>
          <Tooltip label="Close" placement="left">
            <button
              ref={closeButtonRef}
              type="button"
              className="wpn-icon-btn wpn-icon-btn--danger"
              aria-label="Close"
              onClick={onClose}
            >
              <Icon name="close" />
            </button>
          </Tooltip>
        </div>

        <div className="wpn-users-modal__body">
          <p className="wpn-epicflow-modal__subtitle">{description}</p>
          <div className="wpn-epicflow-modal__row">
            <PasswordField
              label="Password"
              value={password}
              placeholder=""
              hint="This password will not be shown again after closing."
              readOnly
              onChange={() => undefined}
            />
          </div>
        </div>

        <div className="wpn-epicflow-modal__footer">
          <button type="button" className="wpn-btn wpn-btn--primary" onClick={onClose}>
            <Icon name="check" className="wpn-btn__icon" />
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

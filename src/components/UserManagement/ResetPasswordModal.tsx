import { useId, useRef, useState, type FormEvent } from "react";
import { Icon, Spinner, Tooltip } from "../primitives";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useScrimDismiss } from "../../hooks/useScrimDismiss";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { MIN_PASSWORD_LENGTH, PasswordField } from "./PasswordField";
import type { ManagedUser } from "../../types/userManagement.types";

interface ResetPasswordModalProps {
  user: ManagedUser;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (password: string | undefined) => void;
}

export function ResetPasswordModal({
  user,
  busy = false,
  onClose,
  onSubmit,
}: ResetPasswordModalProps) {
  useEscapeKey(onClose);
  const scrimProps = useScrimDismiss(onClose);
  const titleId = useId();
  const dialogRef = useRef<HTMLFormElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(dialogRef, closeButtonRef);
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);

  const passwordValid = password.length === 0 || password.length >= MIN_PASSWORD_LENGTH;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!passwordValid || busy) {
      return;
    }
    onSubmit(password || undefined);
  };

  return (
    <div className="wpn-epicflow-modal-scrim" {...scrimProps}>
      <form
        ref={dialogRef}
        className="wpn-epicflow-modal wpn-users-modal wpn-users-reset"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={handleSubmit}
      >
        <div className="wpn-epicflow-modal__header">
          <h2 className="wpn-epicflow-modal__title" id={titleId}>
            Reset password
          </h2>
          <Tooltip label="Close" placement="left">
            <button
              ref={closeButtonRef}
              type="button"
              className="wpn-icon-btn wpn-icon-btn--danger"
              aria-label="Close reset password"
              onClick={onClose}
            >
              <Icon name="close" />
            </button>
          </Tooltip>
        </div>

        <div className="wpn-users-modal__body">
          <p className="wpn-epicflow-modal__subtitle">
            Set a new password for {user.firstName} {user.lastName} ({user.email}). Their current
            password stops working immediately.
          </p>
          <div className="wpn-epicflow-modal__row">
            <PasswordField
              label="New password"
              value={password}
              placeholder="Leave blank to generate one"
              hint="Copy this before saving. Blank generates one shown after saving."
              invalid={touched && !passwordValid}
              onChange={setPassword}
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
              <Icon name="key" className="wpn-btn__icon" />
            )}
            {busy ? "Updating..." : "Update password"}
          </button>
        </div>
      </form>
    </div>
  );
}

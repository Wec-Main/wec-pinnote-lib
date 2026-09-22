import { useEffect, useRef, useState } from "react";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useScrimDismiss } from "../../hooks/useScrimDismiss";
import { getInitials } from "../../utils/format";
import { Icon } from "../primitives";
import type { LoginOption } from "../../types/auth.types";

interface LoginDialogProps {
  user: LoginOption;
  onCancel: () => void;
  onSubmit: (password: string) => Promise<void>;
}

export function LoginDialog({ user, onCancel, onSubmit }: LoginDialogProps) {
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEscapeKey(onCancel);
  const scrimProps = useScrimDismiss(onCancel);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async () => {
    if (!password || pending) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSubmit(password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed.");
      setPassword("");
      inputRef.current?.focus();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="wpn-epicflow-modal-scrim" {...scrimProps}>
      <div
        className="wpn-epicflow-modal wpn-login-dialog"
        role="dialog"
        aria-label={`Log in as ${user.name}`}
      >
        <div className="wpn-login-dialog__identity">
          <span className="wpn-avatar wpn-avatar--fallback wpn-login-dialog__avatar">
            {getInitials(user.name)}
          </span>
          <span className="wpn-login-dialog__identity-copy">
            <span className="wpn-login-dialog__name">{user.name}</span>
            <span className="wpn-login-dialog__email">{user.email}</span>
          </span>
        </div>

        <form
          className="wpn-login-dialog__form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label className="wpn-login-dialog__label" htmlFor="wpn-login-password">
            Password
          </label>
          <div
            className={[
              "wpn-login-dialog__field",
              error ? "wpn-login-dialog__field--invalid" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <input
              id="wpn-login-password"
              ref={inputRef}
              className="wpn-login-dialog__input"
              type={revealed ? "text" : "password"}
              value={password}
              autoComplete="current-password"
              placeholder="Enter your password"
              disabled={pending}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "wpn-login-error" : undefined}
              onChange={(event) => {
                setPassword(event.target.value);
                setError(null);
              }}
            />
            <button
              type="button"
              className="wpn-login-dialog__reveal"
              aria-label={revealed ? "Hide password" : "Show password"}
              onClick={() => setRevealed((current) => !current)}
            >
              <Icon name={revealed ? "eyeOff" : "eye"} />
            </button>
          </div>

          {error ? (
            <p className="wpn-login-dialog__error" id="wpn-login-error" role="alert">
              <Icon name="alert" className="wpn-login-dialog__error-icon" />
              {error}
            </p>
          ) : null}

          <div className="wpn-epicflow-modal__footer">
            <button
              type="button"
              className="wpn-btn wpn-btn--ghost"
              onClick={onCancel}
              disabled={pending}
            >
              <Icon name="close" className="wpn-btn__icon" />
              Cancel
            </button>
            <button
              type="submit"
              className="wpn-btn wpn-btn--primary"
              disabled={!password || pending}
            >
              <Icon name="check" className="wpn-btn__icon" />
              {pending ? "Logging in..." : "Log in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

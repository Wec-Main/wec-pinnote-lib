import { useId, useState } from "react";
import { Icon } from "../../../components/primitives/Icon";
import { Tooltip } from "../../../components/primitives/Tooltip";
import { generatePassword } from "../../../utils/auth/password";

interface PasswordFieldProps {
  label: string;
  value: string;
  placeholder: string;
  hint: string;
  error?: string | null;
  readOnly?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

export function PasswordField({
  label,
  value,
  placeholder,
  hint,
  error,
  readOnly = false,
  onChange,
  onBlur,
}: PasswordFieldProps) {
  const labelId = useId();
  const messageId = useId();
  const [revealed, setRevealed] = useState(readOnly);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setRevealed(true);
    }
  };

  return (
    <div className="wpn-epicflow-modal__field">
      <span className="wpn-epicflow-modal__label" id={labelId}>
        {label}
      </span>
      <div className="wpn-password-field">
        <div className="wpn-password-field__control">
          <input
            className="wpn-epicflow-modal__input wpn-password-field__input"
            type={revealed ? "text" : "password"}
            value={value}
            autoComplete="new-password"
            placeholder={placeholder}
            aria-labelledby={labelId}
            aria-describedby={messageId}
            aria-invalid={error ? true : undefined}
            readOnly={readOnly}
            onBlur={onBlur}
            onChange={(event) => {
              if (readOnly) {
                return;
              }
              onChange(event.target.value);
              setCopied(false);
            }}
          />
          {value ? (
            <Tooltip label={revealed ? "Hide password" : "Show password"} placement="top">
              <button
                type="button"
                className="wpn-password-field__reveal"
                aria-label={revealed ? "Hide password" : "Show password"}
                onClick={() => setRevealed((current) => !current)}
              >
                <Icon name={revealed ? "eyeOff" : "eye"} />
              </button>
            </Tooltip>
          ) : null}
        </div>
        <div className="wpn-password-field__buttons">
          {readOnly ? null : (
            <button
              type="button"
              className="wpn-password-field__generate"
              onClick={() => {
                onChange(generatePassword());
                setRevealed(true);
                setCopied(false);
              }}
            >
              <Icon name="reset" className="wpn-password-field__btn-icon" />
              Generate
            </button>
          )}
          {value ? (
            <button
              type="button"
              className={[
                "wpn-password-field__copy",
                copied ? "wpn-password-field__copy--done" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => void copy()}
            >
              <Icon name={copied ? "check" : "copy"} className="wpn-password-field__btn-icon" />
              {copied ? "Copied" : "Copy"}
            </button>
          ) : null}
        </div>
      </div>
      {error ? (
        <span className="wpn-users-modal__error" id={messageId} role="alert">
          <Icon name="alert" className="wpn-users-modal__error-icon" />
          {error}
        </span>
      ) : (
        <span className="wpn-password-field__hint" id={messageId}>
          {hint}
        </span>
      )}
    </div>
  );
}

import { useId, type ReactNode } from "react";

interface FieldRenderProps {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
  "aria-required": boolean;
}

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
  children: (renderProps: FieldRenderProps) => ReactNode;
}

export function Field({ label, required = false, error, hint, children }: FieldProps) {
  const inputId = useId();
  const errorId = useId();
  const hasError = Boolean(error);

  return (
    <div className="wpn-epicflow-modal__field">
      <label className="wpn-epicflow-modal__label" htmlFor={inputId}>
        {label} {required ? <span className="wpn-epicflow-modal__required">*</span> : null}
      </label>
      {children({
        id: inputId,
        "aria-describedby": hasError ? errorId : undefined,
        "aria-invalid": hasError ? true : undefined,
        "aria-required": required,
      })}
      {hasError ? (
        <span className="wpn-users-modal__error" id={errorId}>
          {error}
        </span>
      ) : hint ? (
        <span className="wpn-password-field__hint">{hint}</span>
      ) : null}
    </div>
  );
}

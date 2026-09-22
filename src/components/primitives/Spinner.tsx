interface SpinnerProps {
  className?: string;
  label?: string;
}

export function Spinner({ className, label }: SpinnerProps) {
  return (
    <span
      className={["wpn-spinner", className].filter(Boolean).join(" ")}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox="0 0 24 24" className="wpn-spinner__svg" focusable="false">
        <circle className="wpn-spinner__track" cx="12" cy="12" r="9" />
        <circle className="wpn-spinner__head" cx="12" cy="12" r="9" />
      </svg>
    </span>
  );
}

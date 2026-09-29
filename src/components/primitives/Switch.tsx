interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, disabled = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={["wpn-switch", checked ? "wpn-switch--on" : ""].filter(Boolean).join(" ")}
      onClick={() => onChange(!checked)}
    >
      <span className="wpn-switch__track">
        <span className="wpn-switch__knob" />
      </span>
    </button>
  );
}

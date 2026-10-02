import { useId } from "react";

interface AddToContextCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function AddToContextCheckbox({
  checked,
  onChange,
  disabled = false,
  className,
}: AddToContextCheckboxProps) {
  const id = useId();
  return (
    <label
      className={className ? `wpn-context-check ${className}` : "wpn-context-check"}
      htmlFor={id}
    >
      <input
        id={id}
        type="checkbox"
        className="wpn-context-check__input"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>Add to context</span>
    </label>
  );
}

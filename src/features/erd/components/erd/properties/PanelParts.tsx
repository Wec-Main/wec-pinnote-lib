import { useState, type CSSProperties, type ReactNode } from "react";
import {
  SearchableSelect,
  type SelectOption,
} from "../../../../../components/primitives/SearchableSelect";

export function PanelHeader({
  title,
  color,
  icon,
}: {
  title: string;
  color?: string;
  icon: ReactNode;
}) {
  return (
    <div
      className="wpn-flowchart-properties__header"
      style={color ? ({ "--node-color": color } as CSSProperties) : undefined}
    >
      <span className="wpn-flowchart-properties__header-icon">{icon}</span>
      <div className="wpn-flowchart-properties__header-text">
        <div className="wpn-flowchart-properties__header-title">{title}</div>
      </div>
    </div>
  );
}

export function CollapsibleSection({
  title,
  children,
  trailing,
}: {
  title: string;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="wpn-flowchart-ui__section">
      <h3 className="wpn-flowchart-ui__section-title wpn-erd__section-title">
        <button
          type="button"
          className="wpn-flowchart-ui__section-toggle"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {title}
        </button>
        {trailing}
      </h3>
      {open && <div className="wpn-flowchart-ui__section-content">{children}</div>}
    </section>
  );
}

export function SelectField({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="wpn-flowchart-ui__field">
      <span className="wpn-flowchart-ui__field-label">{label}</span>
      {disabled ? (
        <input
          className="wpn-flowchart-ui__input"
          value={options.find((o) => o.value === value)?.label ?? ""}
          disabled
          readOnly
        />
      ) : (
        <SearchableSelect
          size="sm"
          ariaLabel={label}
          options={options}
          value={value}
          searchable={options.length > 8}
          onChange={onChange}
        />
      )}
    </div>
  );
}

export const optionalText = (value: string): string | undefined =>
  value === "" ? undefined : value;

export const optionalNumber = (value: string): number | undefined => {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

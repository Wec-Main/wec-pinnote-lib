import type { AnnotationStatus } from "../../../types/annotation.types";
import { ANNOTATION_STATUS_OPTIONS, statusLabel, type StatusOption } from "../../../utils/status";
import { useComboboxList, type ComboboxOption } from "../../../hooks/useComboboxList";
import { Icon } from "../../../components/primitives/Icon";

interface AnnotationStatusSelectProps {
  value: AnnotationStatus;
  onChange: (status: AnnotationStatus) => void;
  disabled?: boolean;
  options?: StatusOption[];
}

export function AnnotationStatusSelect({
  value,
  onChange,
  disabled,
  options = ANNOTATION_STATUS_OPTIONS,
}: AnnotationStatusSelectProps) {
  const {
    open,
    setOpen,
    activeIndex,
    setActiveIndex,
    rootRef,
    triggerRef,
    listboxId,
    optionId,
    activeDescendant,
    openMenu,
    onRootKeyDown,
  } = useComboboxList({ options, activeValue: value });

  const commit = (option: ComboboxOption) => {
    onChange(option.value as AnnotationStatus);
    setOpen(false);
  };

  const currentLabel =
    options.find((option) => option.value === value)?.label ?? statusLabel(value);

  return (
    <div className="wpn-status" ref={rootRef} onKeyDown={(event) => onRootKeyDown(event, commit)}>
      <button
        ref={triggerRef}
        type="button"
        className={`wpn-status__trigger wpn-tone--${value}`}
        disabled={disabled}
        aria-label={`Status: ${currentLabel}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={activeDescendant}
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        <span className="wpn-status__dot" />
        {currentLabel}
        <svg viewBox="0 0 16 16" className="wpn-status__chevron" aria-hidden="true">
          <path fill="currentColor" d="M4.2 6.2 8 10l3.8-3.8L13 7.4 8 12.4 3 7.4z" />
        </svg>
      </button>
      {open ? (
        <div className="wpn-status__menu" role="listbox" id={listboxId} aria-label="Change status">
          <div className="wpn-status__menu-title" aria-hidden="true">
            Change status
          </div>
          {options.map((option, index) => (
            <button
              key={option.value}
              id={optionId(index)}
              type="button"
              role="option"
              aria-selected={option.value === value}
              tabIndex={-1}
              className={`wpn-status__option wpn-tone--${option.value} ${
                option.value === value ? "wpn-status__option--active" : ""
              } ${index === activeIndex ? "wpn-status__option--focused" : ""}`}
              onPointerEnter={() => setActiveIndex(index)}
              onClick={() => commit(option)}
            >
              <span className="wpn-status__dot" />
              <span className="wpn-status__option-copy">
                <span className="wpn-status__option-label">{option.label}</span>
                <span className="wpn-status__option-description">{option.description}</span>
              </span>
              {option.value === value ? <Icon name="check" className="wpn-status__check" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

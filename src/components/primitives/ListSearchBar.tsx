import type { FormEvent, ReactNode } from "react";
import { Icon } from "./Icon";
import { Tooltip } from "./Tooltip";

interface ListSearchBarProps {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  placeholder: string;
  trailing?: ReactNode;
}

export function ListSearchBar({
  value,
  onValueChange,
  onSubmit,
  onClear,
  placeholder,
  trailing,
}: ListSearchBarProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <div className="wpn-searchbar">
      <form className="wpn-searchbar__form" role="search" onSubmit={handleSubmit}>
        <div className="wpn-searchbar__field">
          <Icon name="search" className="wpn-searchbar__icon" />
          <input
            className="wpn-searchbar__input"
            value={value}
            placeholder={placeholder}
            aria-label={placeholder}
            onChange={(event) => onValueChange(event.target.value)}
          />
          {value ? (
            <Tooltip label="Clear search" placement="bottom">
              <button
                type="button"
                className="wpn-searchbar__clear"
                aria-label="Clear search"
                onClick={onClear}
              >
                <Icon name="close" className="wpn-searchbar__clear-icon" />
              </button>
            </Tooltip>
          ) : null}
        </div>
        <button type="submit" className="wpn-searchbar__submit">
          Search
        </button>
      </form>
      {trailing ? <div className="wpn-searchbar__trailing">{trailing}</div> : null}
    </div>
  );
}

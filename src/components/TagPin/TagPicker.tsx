import { useMemo, useState } from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { useComboboxList, type ComboboxOption } from "../../hooks/useComboboxList";
import { Icon } from "../primitives";
import { SelectSearchField, SelectTrigger } from "../primitives/SelectParts";

interface TagPickerProps {
  x: number;
  y: number;
}

export function TagPicker({ x, y }: TagPickerProps) {
  const { projectTags, tagDraft, submitTagDraft, cancelTagDraft } = useAnnotationContext();
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo<ComboboxOption[]>(
    () => projectTags.map((tag) => ({ value: tag.id, label: tag.name })),
    [projectTags],
  );
  const colorByValue = useMemo(
    () => new Map(projectTags.map((tag) => [tag.id, tag.color])),
    [projectTags],
  );

  const {
    open,
    query,
    activeIndex,
    setActiveIndex,
    filtered,
    rootRef,
    inputRef,
    triggerRef,
    listboxId,
    optionId,
    activeDescendant,
    openMenu,
    closeMenu,
    onInputChange,
    onRootKeyDown,
  } = useComboboxList({ options, activeValue: selectedTagId });

  const selectedTag = selectedTagId
    ? (options.find((o) => o.value === selectedTagId) ?? null)
    : null;

  const commit = (option: ComboboxOption) => {
    setSelectedTagId(option.value);
    closeMenu();
  };

  const addTag = () => {
    if (!selectedTagId) {
      return;
    }
    setBusy(true);
    setError(null);
    submitTagDraft(selectedTagId)
      .catch(() => setError("Could not attach that tag. Please try again."))
      .finally(() => setBusy(false));
  };

  return (
    <div
      className="wpn-tag-picker"
      style={{ left: x, top: y }}
      role="dialog"
      aria-label="Pick a tag"
    >
      <div className="wpn-tag-picker__header">
        <span className="wpn-tag-picker__title">{tagDraft?.label ?? "Add tag"}</span>
        <button type="button" className="wpn-icon-btn" aria-label="Cancel" onClick={cancelTagDraft}>
          <Icon name="close" />
        </button>
      </div>

      <div
        className="wpn-select wpn-tag-picker__select"
        ref={rootRef}
        onKeyDown={(event) => onRootKeyDown(event, commit)}
      >
        <SelectTrigger
          triggerRef={triggerRef}
          open={open}
          label={selectedTag?.label ?? ""}
          placeholder="Choose a tag"
          ariaLabel="Choose a tag"
          disabled={busy}
          onToggle={() => (open ? closeMenu() : openMenu())}
        />

        {open ? (
          <div className="wpn-select__menu">
            <SelectSearchField
              inputRef={inputRef}
              value={query}
              placeholder="Search tags"
              ariaLabel="Search tags"
              listboxId={listboxId}
              activeDescendant={activeDescendant}
              disabled={busy}
              onChange={onInputChange}
            />
            <ul className="wpn-select__list" role="listbox" id={listboxId} aria-label="Tags">
              {projectTags.length === 0 ? (
                <li className="wpn-select__empty">
                  No tags yet. Create them in Settings before tagging.
                </li>
              ) : filtered.length === 0 ? (
                <li className="wpn-select__empty">No tags match your search.</li>
              ) : (
                filtered.map((option, index) => (
                  <li key={option.value}>
                    <button
                      type="button"
                      id={optionId(index)}
                      role="option"
                      aria-selected={option.value === selectedTagId}
                      className={[
                        "wpn-select__option",
                        index === activeIndex ? "wpn-select__option--active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      disabled={busy}
                      onPointerEnter={() => setActiveIndex(index)}
                      onClick={() => commit(option)}
                    >
                      <span className="wpn-select__option-copy">
                        <span
                          className="wpn-tag-picker__swatch"
                          style={{ backgroundColor: colorByValue.get(option.value) }}
                        />
                        <span className="wpn-select__option-label">{option.label}</span>
                      </span>
                      {option.value === selectedTagId ? (
                        <Icon name="check" className="wpn-select__option-check" />
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}
      </div>

      {error ? <p className="wpn-tag-picker__error">{error}</p> : null}

      <div className="wpn-tag-picker__footer">
        <button
          type="button"
          className="wpn-btn wpn-btn--ghost"
          disabled={busy}
          onClick={cancelTagDraft}
        >
          Cancel
        </button>
        <button
          type="button"
          className="wpn-btn wpn-btn--primary"
          disabled={!selectedTagId || busy}
          onClick={addTag}
        >
          Add tag
        </button>
      </div>
    </div>
  );
}

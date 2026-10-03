import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Icon, SearchableSelect, Spinner, Tooltip } from "../primitives";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useScrimDismiss } from "../../hooks/useScrimDismiss";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { Field } from "../Settings/Field";
import type { DataModel, DataModelDraft, ErdEngineName } from "../../types/dataModel.types";

const NAME_MAX = 1000;
const DESCRIPTION_MAX = 35000;
const WARN_RATIO = 0.9;

export const DATA_MODEL_ENGINE_OPTIONS: { value: ErdEngineName; label: string }[] = [
  { value: "na", label: "N/A" },
  { value: "postgres", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL" },
  { value: "sqlite", label: "SQLite" },
];

function isEngine(value: string): value is ErdEngineName {
  return DATA_MODEL_ENGINE_OPTIONS.some((option) => option.value === value);
}

interface DataModelFormModalProps {
  dataModel: DataModel | null;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (draft: DataModelDraft) => void;
}

export function DataModelFormModal({
  dataModel,
  busy = false,
  error,
  onCancel,
  onSubmit,
}: DataModelFormModalProps) {
  useEscapeKey(onCancel);
  const scrimProps = useScrimDismiss(onCancel);
  const titleId = useId();
  const dialogRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  useFocusTrap(dialogRef, nameInputRef);

  const [name, setName] = useState(dataModel?.name ?? "");
  const [description, setDescription] = useState(dataModel?.description ?? "");
  const [engine, setEngine] = useState<ErdEngineName>(dataModel?.engine ?? "na");
  const [touched, setTouched] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = descriptionRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [description]);

  const nameValid = name.trim().length > 0;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!nameValid || busy) {
      return;
    }
    onSubmit({ name: name.trim(), description: description.trim() || undefined, engine });
  };

  return (
    <div className="wpn-epicflow-modal-scrim" {...scrimProps}>
      <form
        ref={dialogRef}
        className="wpn-epicflow-modal wpn-users-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={handleSubmit}
      >
        <div className="wpn-epicflow-modal__header">
          <h2 className="wpn-epicflow-modal__title" id={titleId}>
            {dataModel ? "Edit data model" : "Create Data Model"}
          </h2>
          <Tooltip label="Close" placement="left">
            <button
              type="button"
              className="wpn-icon-btn wpn-icon-btn--danger"
              aria-label="Close data model form"
              onClick={onCancel}
              disabled={busy}
            >
              <Icon name="close" />
            </button>
          </Tooltip>
        </div>

        <div className="wpn-users-modal__body">
          <div className="wpn-epicflow-modal__row">
            <Field
              label="Name"
              required
              error={touched && !nameValid ? "A data model name is required." : null}
            >
              {(fieldProps) => (
                <>
                  <input
                    {...fieldProps}
                    ref={nameInputRef}
                    className="wpn-epicflow-modal__input"
                    value={name}
                    maxLength={NAME_MAX}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Billing schema"
                  />
                  <span
                    className={
                      name.length >= NAME_MAX
                        ? "wpn-epicflow-modal__counter wpn-epicflow-modal__counter--limit"
                        : name.length >= NAME_MAX * WARN_RATIO
                          ? "wpn-epicflow-modal__counter wpn-epicflow-modal__counter--warn"
                          : "wpn-epicflow-modal__counter"
                    }
                  >
                    {name.length}/{NAME_MAX}
                  </span>
                </>
              )}
            </Field>
          </div>

          <div className="wpn-epicflow-modal__row">
            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">Description</span>
              <textarea
                ref={descriptionRef}
                className="wpn-epicflow-modal__input wpn-settings-textarea"
                value={description}
                maxLength={DESCRIPTION_MAX}
                rows={3}
                style={{ overflowY: "hidden" }}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What this schema models"
              />
              <span
                className={
                  description.length >= DESCRIPTION_MAX
                    ? "wpn-epicflow-modal__counter wpn-epicflow-modal__counter--limit"
                    : description.length >= DESCRIPTION_MAX * WARN_RATIO
                      ? "wpn-epicflow-modal__counter wpn-epicflow-modal__counter--warn"
                      : "wpn-epicflow-modal__counter"
                }
              >
                {description.length}/{DESCRIPTION_MAX}
              </span>
            </label>
          </div>

          <div className="wpn-epicflow-modal__row">
            <div className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">Engine</span>
              <SearchableSelect
                options={DATA_MODEL_ENGINE_OPTIONS}
                value={engine}
                onChange={(next) => {
                  if (isEngine(next)) {
                    setEngine(next);
                  }
                }}
                ariaLabel="Engine"
              />
            </div>
          </div>

          {error ? <span className="wpn-users-modal__error">{error}</span> : null}
        </div>

        <div className="wpn-epicflow-modal__footer">
          <button
            type="button"
            className="wpn-btn wpn-btn--ghost"
            onClick={onCancel}
            disabled={busy}
          >
            <Icon name="close" className="wpn-btn__icon" />
            Cancel
          </button>
          <button type="submit" className="wpn-btn wpn-btn--primary" disabled={busy}>
            {busy ? (
              <Spinner className="wpn-btn__icon" />
            ) : (
              <Icon name="check" className="wpn-btn__icon" />
            )}
            {dataModel ? "Save changes" : "Create data model"}
          </button>
        </div>
      </form>
    </div>
  );
}

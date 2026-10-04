import { useId, useRef, useState, type FormEvent } from "react";
import { ColorPicker, Icon, MultiSelect, SearchableSelect, Spinner, Tooltip } from "../primitives";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useScrimDismiss } from "../../hooks/useScrimDismiss";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { Field } from "./Field";
import { TAG_COLORS, type ProjectTag, type TagDraft, type TagStatus } from "../../types/tag.types";
import type { Project } from "../../types/organization.types";
import { TAG_STATUS_OPTIONS } from "./tagOptions";

interface TagFormModalProps {
  tag: ProjectTag | null;
  projects: Project[];
  defaultProjectId?: string;
  busy?: boolean;
  fieldErrors?: Record<string, string[]> | null;
  onCancel: () => void;
  onSubmit: (draft: TagDraft) => void;
}

export function TagFormModal({
  tag,
  projects,
  defaultProjectId,
  busy = false,
  fieldErrors,
  onCancel,
  onSubmit,
}: TagFormModalProps) {
  useEscapeKey(onCancel);
  const scrimProps = useScrimDismiss(onCancel);
  const titleId = useId();
  const dialogRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  useFocusTrap(dialogRef, nameInputRef);

  const [projectIds, setProjectIds] = useState<string[]>(
    tag ? [tag.projectId] : defaultProjectId ? [defaultProjectId] : [],
  );
  const [name, setName] = useState(tag?.name ?? "");
  const [color, setColor] = useState<string>(tag?.color ?? TAG_COLORS[5]);
  const [status, setStatus] = useState<TagStatus>(tag?.status ?? "active");
  const [touched, setTouched] = useState(false);

  const projectOptions = projects.map((project) => ({
    value: project.id,
    label: project.name,
    description: project.id,
  }));

  const nameValid = name.trim().length > 0;
  const projectValid = projectIds.length > 0;
  const nameServerError = fieldErrors?.name?.[0];
  const projectServerError = fieldErrors?.projectIds?.[0];

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!nameValid || !projectValid || busy) {
      return;
    }
    onSubmit({ projectIds, name: name.trim(), color, status });
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
            {tag ? "Edit tag" : "New tag"}
          </h2>
          <Tooltip label="Close" placement="left">
            <button
              type="button"
              className="wpn-icon-btn wpn-icon-btn--danger"
              aria-label="Close tag form"
              onClick={onCancel}
            >
              <Icon name="close" />
            </button>
          </Tooltip>
        </div>

        <div className="wpn-users-modal__body">
          <div className="wpn-epicflow-modal__row">
            <Field
              label="Tag name"
              required
              error={nameServerError ?? (touched && !nameValid ? "A tag name is required." : null)}
            >
              {(fieldProps) => (
                <input
                  {...fieldProps}
                  ref={nameInputRef}
                  className="wpn-epicflow-modal__input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Accessibility"
                />
              )}
            </Field>
          </div>

          <div className="wpn-epicflow-modal__row">
            <div className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">
                {tag ? "Project" : "Projects"}{" "}
                <span className="wpn-epicflow-modal__required">*</span>
              </span>
              {tag ? (
                <>
                  <input
                    className="wpn-epicflow-modal__input"
                    value={
                      projects.find((project) => project.id === tag.projectId)?.name ??
                      tag.projectId
                    }
                    disabled
                    readOnly
                  />
                  <span className="wpn-password-field__hint">
                    A tag cannot be moved to another project.
                  </span>
                </>
              ) : (
                <MultiSelect
                  options={projectOptions}
                  values={projectIds}
                  onChange={setProjectIds}
                  ariaLabel="Projects"
                  placeholder="Select projects"
                  searchPlaceholder="Search projects"
                />
              )}
              {(touched && !projectValid) || projectServerError ? (
                <span className="wpn-users-modal__error">
                  {projectServerError ?? "At least one project is required."}
                </span>
              ) : null}
              {!tag && projectIds.length > 1 ? (
                <span className="wpn-password-field__hint">
                  Creates {projectIds.length} separate tags, one per project.
                </span>
              ) : null}
            </div>
            <div className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">Status</span>
              <SearchableSelect
                options={TAG_STATUS_OPTIONS}
                value={status}
                onChange={(value) => setStatus(value as TagStatus)}
                ariaLabel="Status"
              />
            </div>
          </div>

          <div className="wpn-epicflow-modal__row">
            <div className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">Colour</span>
              <ColorPicker
                value={color}
                onChange={(next) => next && setColor(next)}
                palette={[...TAG_COLORS]}
                ariaLabel="Tag colour"
                showValue
              />
              <span className="wpn-tag-preview">
                <span className="wpn-tag-chip" style={{ backgroundColor: color }}>
                  {name.trim() || "Preview"}
                </span>
              </span>
            </div>
          </div>
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
            {tag ? "Save changes" : "Create tag"}
          </button>
        </div>
      </form>
    </div>
  );
}

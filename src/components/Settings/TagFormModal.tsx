import { useState, type FormEvent } from "react";
import { Icon, SearchableSelect, Spinner, Tooltip } from "../primitives";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useScrimDismiss } from "../../hooks/useScrimDismiss";
import { TAG_COLORS, type ProjectTag, type TagDraft, type TagStatus } from "../../types/tag.types";
import type { Project } from "../../types/organization.types";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

interface TagFormModalProps {
  tag: ProjectTag | null;
  projects: Project[];
  defaultProjectId?: string;
  busy?: boolean;
  onCancel: () => void;
  onSubmit: (draft: TagDraft) => void;
}

export function TagFormModal({
  tag,
  projects,
  defaultProjectId,
  busy = false,
  onCancel,
  onSubmit,
}: TagFormModalProps) {
  useEscapeKey(onCancel);
  const scrimProps = useScrimDismiss(onCancel);

  const [projectId, setProjectId] = useState(tag?.projectId ?? defaultProjectId ?? "");
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
  const projectValid = projectId.length > 0;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!nameValid || !projectValid || busy) {
      return;
    }
    onSubmit({ projectId, name: name.trim(), color, status });
  };

  return (
    <div className="wpn-epicflow-modal-scrim" {...scrimProps}>
      <form
        className="wpn-epicflow-modal wpn-users-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wpn-tag-title"
        onSubmit={handleSubmit}
      >
        <div className="wpn-epicflow-modal__header">
          <h2 className="wpn-epicflow-modal__title" id="wpn-tag-title">
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
            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">
                Tag name <span className="wpn-epicflow-modal__required">*</span>
              </span>
              <input
                className="wpn-epicflow-modal__input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Accessibility"
                autoFocus
              />
              {touched && !nameValid ? (
                <span className="wpn-users-modal__error">A tag name is required.</span>
              ) : null}
            </label>
          </div>

          <div className="wpn-epicflow-modal__row">
            <div className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">
                Project <span className="wpn-epicflow-modal__required">*</span>
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
                <SearchableSelect
                  options={projectOptions}
                  value={projectId}
                  onChange={setProjectId}
                  ariaLabel="Project"
                  placeholder="Select a project"
                />
              )}
              {touched && !projectValid ? (
                <span className="wpn-users-modal__error">A project is required.</span>
              ) : null}
            </div>
            <div className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">Status</span>
              <SearchableSelect
                options={STATUS_OPTIONS}
                value={status}
                onChange={(value) => setStatus(value as TagStatus)}
                ariaLabel="Status"
              />
            </div>
          </div>

          <div className="wpn-epicflow-modal__row">
            <div className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">Colour</span>
              <div className="wpn-tag-swatches" role="radiogroup" aria-label="Tag colour">
                {TAG_COLORS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={color === option}
                    aria-label={option}
                    className={[
                      "wpn-tag-swatch",
                      color === option ? "wpn-tag-swatch--selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{ backgroundColor: option }}
                    onClick={() => setColor(option)}
                  >
                    {color === option ? <Icon name="check" /> : null}
                  </button>
                ))}
              </div>
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

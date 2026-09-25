import { useId, useRef, useState, type FormEvent } from "react";
import { Icon, SearchableSelect, Spinner, Tooltip } from "../primitives";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useScrimDismiss } from "../../hooks/useScrimDismiss";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { Field } from "./Field";
import { USER_STATUS_OPTIONS } from "../../data/userManagementOptions";
import type { Organization, Project, ProjectDraft } from "../../types/organization.types";

interface ProjectFormModalProps {
  project: Project | null;
  organizations: Organization[];
  defaultOrganizationId?: string;
  busy?: boolean;
  fieldErrors?: Record<string, string[]> | null;
  onCancel: () => void;
  onSubmit: (draft: ProjectDraft) => void;
}

export function ProjectFormModal({
  project,
  organizations,
  defaultOrganizationId,
  busy = false,
  fieldErrors,
  onCancel,
  onSubmit,
}: ProjectFormModalProps) {
  useEscapeKey(onCancel);
  const scrimProps = useScrimDismiss(onCancel);
  const titleId = useId();
  const dialogRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  useFocusTrap(dialogRef, nameInputRef);

  const [organizationId, setOrganizationId] = useState(
    project?.organizationId ?? defaultOrganizationId ?? "",
  );
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [status, setStatus] = useState(project?.status ?? "active");
  const [touched, setTouched] = useState(false);

  const organizationOptions = organizations.map((organization) => ({
    value: organization.id,
    label: organization.companyName,
    description: organization.slug,
  }));

  const nameValid = name.trim().length > 0;
  const organizationValid = organizationId.length > 0;
  const nameServerError = fieldErrors?.name?.[0];
  const organizationServerError = fieldErrors?.organizationId?.[0];

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!nameValid || !organizationValid || busy) {
      return;
    }
    onSubmit({
      organizationId,
      name: name.trim(),
      description: description.trim() || undefined,
      status,
    });
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
            {project ? "Edit project" : "New project"}
          </h2>
          <Tooltip label="Close" placement="left">
            <button
              type="button"
              className="wpn-icon-btn wpn-icon-btn--danger"
              aria-label="Close project form"
              onClick={onCancel}
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
              error={
                nameServerError ?? (touched && !nameValid ? "A project name is required." : null)
              }
            >
              {(fieldProps) => (
                <input
                  {...fieldProps}
                  ref={nameInputRef}
                  className="wpn-epicflow-modal__input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Acme Web"
                />
              )}
            </Field>
          </div>

          {project ? (
            <div className="wpn-epicflow-modal__row">
              <Field label="Project id" hint="Generated automatically. It never changes.">
                {(fieldProps) => (
                  <input
                    {...fieldProps}
                    className="wpn-epicflow-modal__input"
                    value={project.id}
                    disabled
                  />
                )}
              </Field>
            </div>
          ) : null}

          <div className="wpn-epicflow-modal__row">
            <div className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">
                Organization <span className="wpn-epicflow-modal__required">*</span>
              </span>
              <SearchableSelect
                options={organizationOptions}
                value={organizationId}
                onChange={setOrganizationId}
                ariaLabel="Organization"
                placeholder="Select an organization"
              />
              {organizationServerError || (touched && !organizationValid) ? (
                <span className="wpn-users-modal__error">
                  {organizationServerError ?? "An organization is required."}
                </span>
              ) : null}
            </div>
            <div className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">Status</span>
              <SearchableSelect
                options={USER_STATUS_OPTIONS}
                value={status}
                onChange={setStatus}
                ariaLabel="Status"
              />
            </div>
          </div>

          <div className="wpn-epicflow-modal__row">
            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">Description</span>
              <textarea
                className="wpn-epicflow-modal__input wpn-settings-textarea"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What this workspace covers"
                rows={3}
              />
            </label>
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
            {project ? "Save changes" : "Create project"}
          </button>
        </div>
      </form>
    </div>
  );
}

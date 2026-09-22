import { useState, type FormEvent } from "react";
import { Icon, SearchableSelect, Spinner, Tooltip } from "../primitives";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useScrimDismiss } from "../../hooks/useScrimDismiss";
import { USER_STATUS_OPTIONS } from "../../data/userManagementOptions";
import type { Organization, Project, ProjectDraft } from "../../types/organization.types";

interface ProjectFormModalProps {
  project: Project | null;
  organizations: Organization[];
  defaultOrganizationId?: string;
  busy?: boolean;
  onCancel: () => void;
  onSubmit: (draft: ProjectDraft) => void;
}

export function ProjectFormModal({
  project,
  organizations,
  defaultOrganizationId,
  busy = false,
  onCancel,
  onSubmit,
}: ProjectFormModalProps) {
  useEscapeKey(onCancel);
  const scrimProps = useScrimDismiss(onCancel);

  const [projectId, setProjectId] = useState(project?.id ?? "");
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

  const idValid = /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(projectId);
  const nameValid = name.trim().length > 0;
  const organizationValid = organizationId.length > 0;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!nameValid || !organizationValid || (!project && !idValid) || busy) {
      return;
    }
    onSubmit({
      projectId,
      organizationId,
      name: name.trim(),
      description: description.trim() || undefined,
      status,
    });
  };

  return (
    <div className="wpn-epicflow-modal-scrim" {...scrimProps}>
      <form
        className="wpn-epicflow-modal wpn-users-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wpn-project-title"
        onSubmit={handleSubmit}
      >
        <div className="wpn-epicflow-modal__header">
          <h2 className="wpn-epicflow-modal__title" id="wpn-project-title">
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
            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">
                Project id <span className="wpn-epicflow-modal__required">*</span>
              </span>
              <input
                className="wpn-epicflow-modal__input"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                placeholder="acme-web"
                disabled={Boolean(project)}
                autoFocus={!project}
              />
              <span className="wpn-password-field__hint">
                {project
                  ? "The project id cannot be changed after creation."
                  : "Used by the client as VITE_ANNOTATION_PROJECT_ID."}
              </span>
              {touched && !project && !idValid ? (
                <span className="wpn-users-modal__error">
                  Letters, numbers, dots, underscores and hyphens only.
                </span>
              ) : null}
            </label>
          </div>

          <div className="wpn-epicflow-modal__row">
            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">
                Name <span className="wpn-epicflow-modal__required">*</span>
              </span>
              <input
                className="wpn-epicflow-modal__input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Acme Web"
                autoFocus={Boolean(project)}
              />
              {touched && !nameValid ? (
                <span className="wpn-users-modal__error">A project name is required.</span>
              ) : null}
            </label>
          </div>

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
              {touched && !organizationValid ? (
                <span className="wpn-users-modal__error">An organization is required.</span>
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

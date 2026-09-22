import { useState, type FormEvent } from "react";
import { Icon, SearchableSelect, Spinner, Tooltip } from "../primitives";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useScrimDismiss } from "../../hooks/useScrimDismiss";
import { USER_COUNTRY_OPTIONS, USER_STATUS_OPTIONS } from "../../data/userManagementOptions";
import type { Organization, OrganizationDraft } from "../../types/organization.types";

interface OrganizationFormModalProps {
  organization: Organization | null;
  busy?: boolean;
  onCancel: () => void;
  onSubmit: (draft: OrganizationDraft) => void;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function OrganizationFormModal({
  organization,
  busy = false,
  onCancel,
  onSubmit,
}: OrganizationFormModalProps) {
  useEscapeKey(onCancel);
  const scrimProps = useScrimDismiss(onCancel);

  const [companyName, setCompanyName] = useState(organization?.companyName ?? "");
  const [slug, setSlug] = useState(organization?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(organization));
  const [countryCode, setCountryCode] = useState(organization?.countryCode ?? "");
  const [status, setStatus] = useState(organization?.status ?? "active");
  const [touched, setTouched] = useState(false);

  const effectiveSlug = slugEdited ? slug : slugify(companyName);
  const nameValid = companyName.trim().length > 0;
  const slugValid = /^[a-z0-9][a-z0-9-]*$/.test(effectiveSlug);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!nameValid || !slugValid || busy) {
      return;
    }
    onSubmit({
      companyName: companyName.trim(),
      slug: effectiveSlug,
      countryCode: countryCode || undefined,
      status,
    });
  };

  return (
    <div className="wpn-epicflow-modal-scrim" {...scrimProps}>
      <form
        className="wpn-epicflow-modal wpn-users-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wpn-org-title"
        onSubmit={handleSubmit}
      >
        <div className="wpn-epicflow-modal__header">
          <h2 className="wpn-epicflow-modal__title" id="wpn-org-title">
            {organization ? "Edit organization" : "New organization"}
          </h2>
          <Tooltip label="Close" placement="left">
            <button
              type="button"
              className="wpn-icon-btn wpn-icon-btn--danger"
              aria-label="Close organization form"
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
                Company name <span className="wpn-epicflow-modal__required">*</span>
              </span>
              <input
                className="wpn-epicflow-modal__input"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Acme Industries"
                autoFocus
              />
              {touched && !nameValid ? (
                <span className="wpn-users-modal__error">A company name is required.</span>
              ) : null}
            </label>
          </div>

          <div className="wpn-epicflow-modal__row">
            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">
                Slug <span className="wpn-epicflow-modal__required">*</span>
              </span>
              <input
                className="wpn-epicflow-modal__input"
                value={effectiveSlug}
                onChange={(event) => {
                  setSlugEdited(true);
                  setSlug(event.target.value);
                }}
                placeholder="acme-industries"
              />
              {touched && !slugValid ? (
                <span className="wpn-users-modal__error">
                  Lowercase letters, numbers and hyphens only.
                </span>
              ) : null}
            </label>
          </div>

          <div className="wpn-epicflow-modal__row">
            <div className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">Country</span>
              <SearchableSelect
                options={USER_COUNTRY_OPTIONS}
                value={countryCode}
                onChange={setCountryCode}
                ariaLabel="Country"
                placeholder="Select a country"
                clearable
              />
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
            {organization ? "Save changes" : "Create organization"}
          </button>
        </div>
      </form>
    </div>
  );
}

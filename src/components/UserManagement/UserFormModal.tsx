import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Icon,
  MultiSelect,
  SearchableSelect,
  Spinner,
  Tooltip,
  type SelectOption,
} from "../primitives";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useScrimDismiss } from "../../hooks/useScrimDismiss";
import {
  categoryLabel,
  roleLabel,
  USER_CATEGORY_OPTIONS,
  USER_COUNTRY_OPTIONS,
  USER_ROLE_OPTIONS,
} from "../../data/userManagementOptions";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { assignableRoles, canChangePrivileges } from "../../utils/permissions";
import { fetchProjects } from "../../services/organizationsApi";
import type { Project } from "../../types/organization.types";
import { MIN_PASSWORD_LENGTH, PasswordField } from "./PasswordField";
import type {
  ManagedUser,
  ManagedUserDraft,
  UserManagementCategory,
  UserManagementRole,
} from "../../types/userManagement.types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface UserFormModalProps {
  user: ManagedUser | null;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (draft: ManagedUserDraft) => void;
}

export function UserFormModal({
  user,
  busy = false,
  onClose,
  onSubmit,
}: UserFormModalProps) {
  useEscapeKey(onClose);
  const scrimProps = useScrimDismiss(onClose);
  const { activeAccount, config } = useAnnotationContext();
  const actorRole = activeAccount?.roleId ?? "developer";
  const mayChangePrivileges = canChangePrivileges(actorRole, activeAccount?.id ?? "", user);
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [roleId, setRoleId] = useState<UserManagementRole>(() => {
    if (user) {
      return user.roleId;
    }
    const allowed = assignableRoles(actorRole);
    return allowed.includes("contributor") ? "contributor" : (allowed[0] ?? "contributor");
  });
  const [countryCode, setCountryCode] = useState(user?.countryCode ?? USER_COUNTRY_OPTIONS[0].value);
  const [category, setCategory] = useState<UserManagementCategory>(user?.category ?? "internal");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [projectIds, setProjectIds] = useState<string[]>(
    () => user?.projects.map((project) => project.id) ?? [],
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const apiBaseUrl = config.apiBaseUrl;
  const actorId = activeAccount?.id;
  const organizationId = activeAccount?.organizationId;

  useEffect(() => {
    const controller = new AbortController();
    setProjectsError(null);
    fetchProjects(apiBaseUrl, actorId, organizationId, controller.signal)
      .then(setProjects)
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setProjectsError(err instanceof Error ? err.message : "Could not load projects.");
        }
      });
    return () => controller.abort();
  }, [apiBaseUrl, actorId, organizationId]);

  const roleOptions = useMemo<SelectOption[]>(() => {
    const allowed = assignableRoles(actorRole);
    return USER_ROLE_OPTIONS.filter((option) => allowed.includes(option.value)).map((option) => ({
      value: option.value,
      label: option.label,
    }));
  }, [actorRole]);
  const projectOptions = useMemo<SelectOption[]>(
    () =>
      projects.map((project) => ({
        value: project.id,
        label: project.name,
        description: project.id,
      })),
    [projects],
  );
  const countryOptions = useMemo<SelectOption[]>(
    () =>
      USER_COUNTRY_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        description: option.value,
      })),
    [],
  );
  const categoryOptions = useMemo<SelectOption[]>(
    () =>
      USER_CATEGORY_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    [],
  );

  const isSuperAdmin = roleId === "super_admin";

  const trimmedFirstName = firstName.trim();
  const trimmedLastName = lastName.trim();
  const trimmedEmail = email.trim();
  const emailValid = EMAIL_PATTERN.test(trimmedEmail);
  const passwordValid = password.length === 0 || password.length >= MIN_PASSWORD_LENGTH;
  const canSubmit =
    Boolean(trimmedFirstName) && Boolean(trimmedLastName) && emailValid && passwordValid;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!canSubmit || busy) {
      return;
    }
    onSubmit({
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      email: trimmedEmail,
      phone: phone.trim(),
      roleId,
      status: user?.status ?? "active",
      countryCode,
      password: password || undefined,
      projectIds: isSuperAdmin ? [] : projectIds,
      category: isSuperAdmin ? undefined : category,
    });
  };

  return (
    <div className="wpn-epicflow-modal-scrim" {...scrimProps}>
      <form
        className="wpn-epicflow-modal wpn-users-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wpn-users-modal-title"
        onSubmit={handleSubmit}
      >
        <div className="wpn-epicflow-modal__header">
          <h2 className="wpn-epicflow-modal__title" id="wpn-users-modal-title">{user ? "Edit user" : "Create user"}</h2>
          <Tooltip label="Close" placement="left">
            <button
              type="button"
              className="wpn-icon-btn wpn-icon-btn--danger"
              aria-label="Close user form"
              onClick={onClose}
            >
              <Icon name="close" />
            </button>
          </Tooltip>
        </div>

        <div className="wpn-users-modal__body">
          <div className="wpn-epicflow-modal__row">
            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">
                First name <span className="wpn-epicflow-modal__required">*</span>
              </span>
              <input
                className="wpn-epicflow-modal__input"
                value={firstName}
                placeholder="e.g. Priya"
                onChange={(event) => setFirstName(event.target.value)}
                autoFocus
              />
            </label>
            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">
                Last name <span className="wpn-epicflow-modal__required">*</span>
              </span>
              <input
                className="wpn-epicflow-modal__input"
                value={lastName}
                placeholder="e.g. Raghavan"
                onChange={(event) => setLastName(event.target.value)}
              />
            </label>
          </div>

          <div className="wpn-epicflow-modal__row">
            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">
                Email <span className="wpn-epicflow-modal__required">*</span>
              </span>
              <input
                className="wpn-epicflow-modal__input"
                type="email"
                value={email}
                placeholder="name@company.com"
                onChange={(event) => setEmail(event.target.value)}
              />
              {touched && !emailValid ? (
                <span className="wpn-users-modal__error">Enter a valid email address.</span>
              ) : null}
            </label>
            <label className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">Phone</span>
              <input
                className="wpn-epicflow-modal__input"
                value={phone}
                placeholder="+91 80 4718 2210"
                onChange={(event) => setPhone(event.target.value)}
              />
            </label>
          </div>

          <div className="wpn-epicflow-modal__row">
            <div className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">Role</span>
              {mayChangePrivileges ? (
                <SearchableSelect
                  options={roleOptions}
                  value={roleId}
                  onChange={(next) => setRoleId(next as UserManagementRole)}
                  ariaLabel="Role"
                  searchPlaceholder="Search roles"
                />
              ) : (
                <>
                  <span className="wpn-settings-readonly">{roleLabel(roleId)}</span>
                  <span className="wpn-password-field__hint">
                    Your role cannot change this.
                  </span>
                </>
              )}
            </div>
            <div className="wpn-epicflow-modal__field">
              <span className="wpn-epicflow-modal__label">Country</span>
              <SearchableSelect
                options={countryOptions}
                value={countryCode}
                onChange={setCountryCode}
                ariaLabel="Country"
                searchPlaceholder="Search countries"
              />
            </div>
          </div>

          {isSuperAdmin ? null : (
            <div className="wpn-epicflow-modal__row">
              <div className="wpn-epicflow-modal__field">
                <span className="wpn-epicflow-modal__label">Projects</span>
                {mayChangePrivileges ? (
                  <>
                    <MultiSelect
                      options={projectOptions}
                      values={projectIds}
                      onChange={setProjectIds}
                      ariaLabel="Assigned projects"
                      placeholder="No projects assigned"
                      searchPlaceholder="Search projects"
                      emptyMessage="No projects in this organization."
                    />
                    <span className="wpn-password-field__hint">
                      {projectsError ?? "Controls which workspaces this user can open."}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="wpn-settings-readonly">
                      {user && user.projects.length > 0
                        ? user.projects.map((project) => project.name).join(", ")
                        : "No projects assigned"}
                    </span>
                    <span className="wpn-password-field__hint">Your role cannot change this.</span>
                  </>
                )}
              </div>
              <div className="wpn-epicflow-modal__field">
                <span className="wpn-epicflow-modal__label">Category</span>
                {mayChangePrivileges ? (
                  <>
                    <SearchableSelect
                      options={categoryOptions}
                      value={category}
                      onChange={(next) => setCategory(next as UserManagementCategory)}
                      ariaLabel="Category"
                      searchPlaceholder="Search categories"
                    />
                    <span className="wpn-password-field__hint">
                      Classifies this user as internal staff, external partner, or customer.
                    </span>
                  </>
                ) : (
                  <>
                    <span className="wpn-settings-readonly">{categoryLabel(category)}</span>
                    <span className="wpn-password-field__hint">Your role cannot change this.</span>
                  </>
                )}
              </div>
            </div>
          )}

          {user ? null : (
            <div className="wpn-epicflow-modal__row">
              <PasswordField
                label="Password"
                value={password}
                placeholder="Leave blank to generate one"
                hint="Share this with the user. Blank generates one shown after creating."
                invalid={touched && !passwordValid}
                onChange={setPassword}
              />
            </div>
          )}
        </div>

        <div className="wpn-epicflow-modal__footer">
          <button
            type="button"
            className="wpn-btn wpn-btn--ghost"
            onClick={onClose}
            disabled={busy}
          >
            <Icon name="close" className="wpn-btn__icon" />
            Cancel
          </button>
          <button
            type="submit"
            className="wpn-btn wpn-btn--primary"
            disabled={!canSubmit || busy}
          >
            {busy ? (
              <Spinner className="wpn-btn__icon" />
            ) : (
              <Icon name={user ? "check" : "plus"} className="wpn-btn__icon" />
            )}
            {busy ? "Saving..." : user ? "Save changes" : "Create user"}
          </button>
        </div>
      </form>
    </div>
  );
}

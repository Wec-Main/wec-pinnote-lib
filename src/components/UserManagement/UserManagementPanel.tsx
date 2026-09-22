import { useCallback, useEffect, useMemo, useState } from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { formatRelativeTime, getInitials } from "../../utils/format";
import {
  Icon,
  ListSearchBar,
  SearchableSelect,
  TablePagination,
  TableSkeleton,
  Tooltip,
  type SelectOption,
} from "../primitives";
import {
  categoryLabel,
  countryLabel,
  roleLabel,
  USER_CATEGORY_OPTIONS,
  USER_ROLE_OPTIONS,
  USER_STATUS_OPTIONS,
  userStatusLabel,
} from "../../data/userManagementOptions";
import {
  createUser,
  deleteUser,
  fetchUsers,
  resetUserPassword,
  updateUser,
} from "../../services/usersApi";
import type { ManagedUser, ManagedUserDraft } from "../../types/userManagement.types";
import { canCreateUsers, canDeleteUser, canEditUser, userScopeFor } from "../../utils/permissions";
import { UserFormModal } from "./UserFormModal";
import { ResetPasswordModal } from "./ResetPasswordModal";
import { ConfirmDialog } from "./ConfirmDialog";

type PendingAction =
  { kind: "delete"; user: ManagedUser } | { kind: "create"; draft: ManagedUserDraft };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function UserManagementPanel() {
  const { config, activeAccount, reloadLoginOptions } = useAnnotationContext();
  const actorId = activeAccount?.id;
  const actorRole = activeAccount?.roleId ?? "developer";
  const selfOnly = userScopeFor(actorRole) === "self";
  const mayCreate = canCreateUsers(actorRole);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ManagedUser | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  const reloadAll = useCallback(() => {
    reload();
    reloadLoginOptions();
  }, [reload, reloadLoginOptions]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);

    fetchUsers(
      config.apiBaseUrl,
      actorId,
      {
        projectId: config.projectId,
        search: searchQuery || undefined,
        roleId: roleFilter || undefined,
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      },
      controller.signal,
    )
      .then((result) => {
        setUsers(result.users);
        setTotal(result.total);
        setLoading(false);
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setLoadError(errorMessage(err));
        setLoading(false);
      });

    return () => controller.abort();
  }, [
    config.apiBaseUrl,
    config.projectId,
    actorId,
    searchQuery,
    roleFilter,
    statusFilter,
    categoryFilter,
    page,
    pageSize,
    reloadToken,
  ]);

  const roleOptions = useMemo<SelectOption[]>(
    () => USER_ROLE_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
    [],
  );
  const statusOptions = useMemo<SelectOption[]>(
    () => USER_STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
    [],
  );
  const categoryOptions = useMemo<SelectOption[]>(
    () => USER_CATEGORY_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
    [],
  );

  const filtersActive = Boolean(searchQuery || roleFilter || statusFilter || categoryFilter);

  const resetFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setRoleFilter("");
    setStatusFilter("");
    setCategoryFilter("");
    setPage(1);
  };

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (user: ManagedUser) => {
    setEditTarget(user);
    setFormOpen(true);
  };

  const handleFormSubmit = async (draft: ManagedUserDraft) => {
    if (!editTarget) {
      setPending({ kind: "create", draft });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await updateUser(config.apiBaseUrl, actorId, config.projectId, editTarget.id, draft);
      setNotice(`${draft.firstName} ${draft.lastName} updated.`);
      setFormOpen(false);
      setEditTarget(null);
      reloadAll();
    } catch (err) {
      setNotice(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleResetSubmit = async (password: string | undefined) => {
    if (!resetTarget) {
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const result = await resetUserPassword(
        config.apiBaseUrl,
        actorId,
        config.projectId,
        resetTarget.id,
        password,
      );
      setNotice(`New password for ${resetTarget.email}: ${result.password}`);
      setResetTarget(null);
      reloadAll();
    } catch (err) {
      setNotice(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmPending = async () => {
    if (!pending) {
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      if (pending.kind === "delete") {
        const { user } = pending;
        await deleteUser(config.apiBaseUrl, actorId, config.projectId, user.id);
        setNotice(`${user.firstName} ${user.lastName} deleted.`);
      } else {
        const { draft } = pending;
        const created = await createUser(config.apiBaseUrl, actorId, config.projectId, draft);
        setNotice(
          created.generatedPassword
            ? `${draft.firstName} ${draft.lastName} created. Temporary password: ${created.generatedPassword}`
            : `${draft.firstName} ${draft.lastName} created.`,
        );
        setPage(1);
        setFormOpen(false);
        setEditTarget(null);
      }
      setPending(null);
      reloadAll();
    } catch (err) {
      setNotice(errorMessage(err));
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  const pendingCopy = (action: PendingAction) => {
    if (action.kind === "delete") {
      const name = `${action.user.firstName} ${action.user.lastName}`;
      return {
        title: "Delete user",
        description: `${name} (${action.user.email}) will lose access immediately. This cannot be undone.`,
        confirmLabel: "Delete user",
        confirmIcon: "trash" as const,
        destructive: true,
      };
    }
    const name = `${action.draft.firstName} ${action.draft.lastName}`;
    return {
      title: "Create user",
      description: `${name} (${action.draft.email}) will be added as ${roleLabel(action.draft.roleId)} and can sign in straight away.`,
      confirmLabel: "Create user",
      confirmIcon: "plus" as const,
      destructive: false,
    };
  };

  return (
    <div className="wpn-settings-tab">
      {selfOnly ? (
        <p className="wpn-settings-scope-note">
          You can see and edit your own profile. Ask an admin for changes to anyone else.
        </p>
      ) : null}

      <ListSearchBar
        value={searchInput}
        onValueChange={setSearchInput}
        onSubmit={() => {
          setSearchQuery(searchInput);
          setPage(1);
        }}
        onClear={() => {
          setSearchInput("");
          setSearchQuery("");
          setPage(1);
        }}
        placeholder="Search name, email or organization"
        trailing={
          <>
            {selfOnly ? null : (
              <>
                <SearchableSelect
                  options={roleOptions}
                  value={roleFilter}
                  onChange={(next) => {
                    setRoleFilter(next);
                    setPage(1);
                  }}
                  placeholder="All roles"
                  searchPlaceholder="Search roles"
                  ariaLabel="Filter by role"
                  clearable
                />
                <SearchableSelect
                  options={statusOptions}
                  value={statusFilter}
                  onChange={(next) => {
                    setStatusFilter(next);
                    setPage(1);
                  }}
                  placeholder="All statuses"
                  searchPlaceholder="Search statuses"
                  ariaLabel="Filter by status"
                  clearable
                />
                <SearchableSelect
                  options={categoryOptions}
                  value={categoryFilter}
                  onChange={(next) => {
                    setCategoryFilter(next);
                    setPage(1);
                  }}
                  placeholder="All categories"
                  searchPlaceholder="Search categories"
                  ariaLabel="Filter by category"
                  clearable
                />
              </>
            )}
            <Tooltip label={loading ? "Refreshing..." : "Refresh"} placement="bottom">
              <button
                type="button"
                className="wpn-refresh-btn"
                aria-label="Refresh users"
                aria-busy={loading}
                disabled={loading}
                onClick={reload}
              >
                <Icon
                  name="refresh"
                  className={[
                    "wpn-refresh-btn__icon",
                    loading ? "wpn-icon-btn__icon--spinning" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
                {loading ? "Refreshing" : "Refresh"}
              </button>
            </Tooltip>
            {mayCreate ? (
              <Tooltip label="Add a new user" placement="bottom">
                <button type="button" className="wpn-users-create" onClick={openCreate}>
                  <Icon name="plus" className="wpn-users-create__icon" />
                  Create user
                </button>
              </Tooltip>
            ) : null}
          </>
        }
      />

      {notice ? (
        <div className="wpn-users-notice" role="status">
          <span>{notice}</span>
          <Tooltip label="Dismiss" placement="left">
            <button
              type="button"
              className="wpn-icon-btn"
              aria-label="Dismiss notification"
              onClick={() => setNotice(null)}
            >
              <Icon name="close" />
            </button>
          </Tooltip>
        </div>
      ) : null}

      <div className="wpn-users-table-wrap">
        <table
          className={["wpn-users-table", loading && loaded ? "wpn-users-table--refetching" : ""]
            .filter(Boolean)
            .join(" ")}
        >
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Role</th>
              <th scope="col">Project</th>
              <th scope="col">Country</th>
              <th scope="col">Category</th>
              <th scope="col">Last active</th>
              <th scope="col">Status</th>
              <th scope="col" className="wpn-users-table__actions-head">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && !loaded ? (
              <TableSkeleton
                rows={Math.min(pageSize, 5)}
                columns={["identity", "pill", "text", "text", "text", "text", "pill", "actions"]}
                label="Loading users..."
              />
            ) : loadError && users.length === 0 ? (
              <tr>
                <td colSpan={8} className="wpn-users-table__empty">
                  <span>{loadError}</span>
                  <button type="button" className="wpn-btn wpn-btn--ghost" onClick={reload}>
                    <Icon name="refresh" className="wpn-btn__icon" />
                    Retry
                  </button>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={8} className="wpn-users-table__empty">
                  <Icon name="users" className="wpn-users-table__empty-icon" />
                  <span>No users match your search.</span>
                  {filtersActive ? (
                    <button type="button" className="wpn-btn wpn-btn--ghost" onClick={resetFilters}>
                      <Icon name="refresh" className="wpn-btn__icon" />
                      Clear filters
                    </button>
                  ) : null}
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="wpn-users-identity">
                      <span className="wpn-avatar wpn-avatar--fallback">
                        {getInitials(`${user.firstName} ${user.lastName}`)}
                      </span>
                      <span className="wpn-users-identity__copy">
                        <span className="wpn-users-identity__name">
                          {user.firstName} {user.lastName}
                        </span>
                        <span className="wpn-users-identity__email">{user.email}</span>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`wpn-users-pill wpn-users-pill--role-${user.roleId}`}>
                      {roleLabel(user.roleId)}
                    </span>
                  </td>
                  <td>
                    {user.projects.length === 0 ? (
                      <span className="wpn-users-projects__empty">N/A</span>
                    ) : (
                      <span className="wpn-users-projects">
                        {user.projects.map((project) => (
                          <span key={project.id} className="wpn-users-projects__item">
                            {project.name}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="wpn-users-org__country">{countryLabel(user.countryCode)}</span>
                  </td>
                  <td>
                    {user.category ? (
                      <span className="wpn-users-org__country">{categoryLabel(user.category)}</span>
                    ) : (
                      <span className="wpn-users-projects__empty">N/A</span>
                    )}
                  </td>
                  <td className="wpn-users-table__muted">
                    {user.lastActiveAt ? formatRelativeTime(user.lastActiveAt) : "Never"}
                  </td>
                  <td>
                    <span className={`wpn-users-pill wpn-users-pill--status-${user.status}`}>
                      {userStatusLabel(user.status)}
                    </span>
                  </td>
                  <td>
                    <div className="wpn-users-actions">
                      {canEditUser(actorRole, actorId ?? "", user) ? (
                        <>
                          <Tooltip label="Edit user" placement="left">
                            <button
                              type="button"
                              className="wpn-users-action"
                              aria-label={`Edit ${user.firstName} ${user.lastName}`}
                              onClick={() => openEdit(user)}
                            >
                              <Icon name="edit" />
                            </button>
                          </Tooltip>
                          <Tooltip label="Reset password" placement="left">
                            <button
                              type="button"
                              className="wpn-users-action"
                              aria-label={`Reset password for ${user.firstName} ${user.lastName}`}
                              onClick={() => setResetTarget(user)}
                            >
                              <Icon name="key" />
                            </button>
                          </Tooltip>
                        </>
                      ) : null}
                      {canDeleteUser(actorRole, actorId ?? "", user) ? (
                        <Tooltip label="Delete user" placement="left">
                          <button
                            type="button"
                            className="wpn-users-action wpn-users-action--danger"
                            aria-label={`Delete ${user.firstName} ${user.lastName}`}
                            onClick={() => setPending({ kind: "delete", user })}
                          >
                            <Icon name="trash" />
                          </button>
                        </Tooltip>
                      ) : null}
                      {canEditUser(actorRole, actorId ?? "", user) ||
                      canDeleteUser(actorRole, actorId ?? "", user) ? null : (
                        <span className="wpn-users-actions__none">View only</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={page}
        pageSize={pageSize}
        totalItems={total}
        itemLabel="users"
        onPageChange={setPage}
        onPageSizeChange={(next) => {
          setPageSize(next);
          setPage(1);
        }}
      />

      {formOpen ? (
        <UserFormModal
          user={editTarget}
          busy={busy}
          onClose={() => {
            setFormOpen(false);
            setEditTarget(null);
          }}
          onSubmit={(draft) => void handleFormSubmit(draft)}
        />
      ) : null}

      {resetTarget ? (
        <ResetPasswordModal
          user={resetTarget}
          busy={busy}
          onClose={() => setResetTarget(null)}
          onSubmit={(password) => void handleResetSubmit(password)}
        />
      ) : null}

      {pending ? (
        <ConfirmDialog
          {...pendingCopy(pending)}
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => void confirmPending()}
        />
      ) : null}
    </div>
  );
}

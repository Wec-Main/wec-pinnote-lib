import { useCallback, useMemo, useState } from "react";
import { useAnnotationContext } from "../../../context/AnnotationContext";
import { formatRelativeTime, getInitials } from "../../../utils/format";
import { DataTable, resolveDataTableState } from "../../../components/primitives/DataTable";
import { Icon } from "../../../components/primitives/Icon";
import { ListSearchBar } from "../../../components/primitives/ListSearchBar";
import { RefreshButton } from "../../../components/primitives/RefreshButton";
import {
  SearchableSelect,
  type SelectOption,
} from "../../../components/primitives/SearchableSelect";
import { TablePagination } from "../../../components/primitives/TablePagination";
import { Tooltip } from "../../../components/primitives/Tooltip";
import {
  categoryLabel,
  roleLabel,
  USER_CATEGORY_OPTIONS,
  USER_ROLE_OPTIONS,
  USER_STATUS_OPTIONS,
  userStatusLabel,
} from "../userManagementOptions";
import {
  createUser,
  deleteUser,
  fetchUsers,
  resetUserPassword,
  updateUser,
} from "../../../services/userManagementService";
import type { ManagedUser, ManagedUserDraft } from "../../../types/userManagement.types";
import {
  canCreateUsers,
  canDeleteUser,
  canEditUser,
  userScopeFor,
} from "../../../utils/auth/permissions";
import { UserFormModal } from "./UserFormModal";
import { ResetPasswordModal } from "./ResetPasswordModal";
import { ConfirmDialog } from "./ConfirmDialog";
import { GeneratedPasswordModal } from "./GeneratedPasswordModal";
import { useResourceTable } from "../../settings/components/useResourceTable";

interface GeneratedPassword {
  title: string;
  description: string;
  password: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function UserManagementPanel() {
  const { config, activeAccount, reloadLoginOptions } = useAnnotationContext();
  const actorId = activeAccount?.id;
  const getAuthToken = config.getAuthToken;
  const actorRole = activeAccount?.roleId ?? "developer";
  const selfOnly = userScopeFor(actorRole) === "self";
  const mayCreate = canCreateUsers(actorRole);
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  const [pendingCreateDraft, setPendingCreateDraft] = useState<ManagedUserDraft | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<GeneratedPassword | null>(null);

  const {
    items: users,
    total,
    loading,
    loaded,
    error: loadError,
    notice,
    busy,
    formOpen,
    editTarget,
    pendingDelete,
    submitDetails,
    search,
    setSearch,
    query,
    setQuery,
    open,
    closeForm,
    askDelete,
    cancelDelete,
    submit,
    confirmDelete,
    dismissNotice,
    reload,
  } = useResourceTable<ManagedUser, ManagedUserDraft>({
    load: async (searchQuery, signal) => {
      const result = await fetchUsers(
        config.apiBaseUrl,
        getAuthToken,
        {
          projectId: config.projectId,
          search: searchQuery || undefined,
          roleId: roleFilter || undefined,
          status: statusFilter || undefined,
          category: categoryFilter || undefined,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        },
        signal,
      );
      return { items: result.users, total: result.total };
    },
    create: async (draft) => {
      const result = await createUser(config.apiBaseUrl, getAuthToken, config.projectId, draft);
      reloadLoginOptions();
      return result;
    },
    update: async (id, draft) => {
      const result = await updateUser(config.apiBaseUrl, getAuthToken, config.projectId, id, draft);
      reloadLoginOptions();
      return result;
    },
    remove: async (id) => {
      await deleteUser(config.apiBaseUrl, getAuthToken, config.projectId, id);
      reloadLoginOptions();
    },
    getId: (user) => user.id,
    draftLabel: (draft) => `${draft.firstName} ${draft.lastName}`,
    itemLabel: (user) => `${user.firstName} ${user.lastName}`,
    deps: [
      config.apiBaseUrl,
      config.projectId,
      actorId,
      roleFilter,
      statusFilter,
      categoryFilter,
      page,
      pageSize,
    ],
  });

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

  const filtersActive = Boolean(query || roleFilter || statusFilter || categoryFilter);

  const resetFilters = () => {
    setSearch("");
    setQuery("");
    setRoleFilter("");
    setStatusFilter("");
    setCategoryFilter("");
    setPage(1);
  };

  const openCreate = useCallback(() => open(), [open]);
  const openEdit = useCallback((user: ManagedUser) => open(user), [open]);

  const handleFormSubmit = (draft: ManagedUserDraft) => {
    if (editTarget) {
      void submit(draft);
      return;
    }
    setPendingCreateDraft(draft);
  };

  const confirmCreate = async () => {
    if (!pendingCreateDraft) {
      return;
    }
    const draft = pendingCreateDraft;
    setPendingCreateDraft(null);
    setPage(1);
    await submit(draft);
  };

  const handleResetSubmit = async (password: string | undefined) => {
    if (!resetTarget) {
      return;
    }
    setResetBusy(true);
    setResetNotice(null);
    try {
      const result = await resetUserPassword(
        config.apiBaseUrl,
        getAuthToken,
        config.projectId,
        resetTarget.id,
        password,
      );
      setGeneratedPassword({
        title: "Password reset",
        description: password
          ? `The new password for ${resetTarget.firstName} ${resetTarget.lastName} (${resetTarget.email}) is set below.`
          : `A new password was generated for ${resetTarget.firstName} ${resetTarget.lastName} (${resetTarget.email}).`,
        password: result.password,
      });
      setResetTarget(null);
      reload();
      reloadLoginOptions();
    } catch (err) {
      setResetNotice(errorMessage(err));
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div className="wpn-settings-tab">
      <ListSearchBar
        value={search}
        onValueChange={setSearch}
        onSubmit={() => {
          setQuery(search);
          setPage(1);
        }}
        onClear={() => {
          setSearch("");
          setQuery("");
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
            <RefreshButton label="Refresh users" loading={loading} onRefresh={reload} />
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

      {notice || resetNotice ? (
        <div className="wpn-users-notice" role="status">
          <span>{notice ?? resetNotice}</span>
          <Tooltip label="Dismiss" placement="left">
            <button
              type="button"
              className="wpn-icon-btn"
              aria-label="Dismiss notification"
              onClick={() => {
                dismissNotice();
                setResetNotice(null);
              }}
            >
              <Icon name="close" />
            </button>
          </Tooltip>
        </div>
      ) : null}

      <DataTable<ManagedUser>
        state={resolveDataTableState({
          loading,
          loaded,
          error: loadError,
          isEmpty: users.length === 0,
        })}
        items={users}
        getRowKey={(user) => user.id}
        refetching={loading && loaded}
        colgroup={
          <colgroup>
            <col className="wpn-users-table__col-name" />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col className="wpn-users-table__col-actions" />
          </colgroup>
        }
        skeleton={{
          rows: Math.min(pageSize, 5),
          columns: ["identity", "pill", "text", "text", "text", "pill", "actions"],
          label: "Loading users...",
        }}
        head={
          <>
            <th scope="col">Name</th>
            <th scope="col">Role</th>
            <th scope="col">Project</th>
            <th scope="col">Category</th>
            <th scope="col">Last active</th>
            <th scope="col">Status</th>
            <th scope="col" className="wpn-users-table__actions-head">
              Actions
            </th>
          </>
        }
        errorRow={
          <tr>
            <td colSpan={7} className="wpn-users-table__empty">
              <span>{loadError}</span>
              <button type="button" className="wpn-btn wpn-btn--ghost" onClick={reload}>
                <Icon name="refresh" className="wpn-btn__icon" />
                Retry
              </button>
            </td>
          </tr>
        }
        emptyRow={
          <tr>
            <td colSpan={7} className="wpn-users-table__empty">
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
        }
        renderRow={(user) => (
          <tr>
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
                        className="wpn-users-action wpn-users-action--primary"
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
                      onClick={() => askDelete(user)}
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
        )}
        pagination={
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
        }
      />

      {formOpen ? (
        <UserFormModal
          user={editTarget}
          busy={busy}
          fieldErrors={submitDetails?.fieldErrors ?? null}
          onClose={closeForm}
          onSubmit={handleFormSubmit}
        />
      ) : null}

      {resetTarget ? (
        <ResetPasswordModal
          user={resetTarget}
          busy={resetBusy}
          onClose={() => setResetTarget(null)}
          onSubmit={(password) => void handleResetSubmit(password)}
        />
      ) : null}

      {pendingCreateDraft ? (
        <ConfirmDialog
          title="Create user"
          description={`${pendingCreateDraft.firstName} ${pendingCreateDraft.lastName} (${pendingCreateDraft.email}) will be added as ${roleLabel(pendingCreateDraft.roleId)} and can sign in straight away.`}
          confirmLabel="Create user"
          confirmIcon="plus"
          busy={busy}
          onCancel={() => setPendingCreateDraft(null)}
          onConfirm={() => void confirmCreate()}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete user"
          description={`${pendingDelete.firstName} ${pendingDelete.lastName} (${pendingDelete.email}) will lose access immediately. This cannot be undone.`}
          confirmLabel="Delete user"
          confirmIcon="trash"
          destructive
          busy={busy}
          onCancel={cancelDelete}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}

      {generatedPassword ? (
        <GeneratedPasswordModal
          title={generatedPassword.title}
          description={generatedPassword.description}
          password={generatedPassword.password}
          onClose={() => setGeneratedPassword(null)}
        />
      ) : null}
    </div>
  );
}

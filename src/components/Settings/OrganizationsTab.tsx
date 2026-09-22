import { useMemo } from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import {
  createOrganization,
  deleteOrganization,
  fetchOrganizations,
  updateOrganization,
} from "../../services/organizationsApi";
import type { Organization, OrganizationDraft } from "../../types/organization.types";
import { Icon, ListSearchBar, RefreshButton, TableSkeleton, Tooltip } from "../primitives";
import { ConfirmDialog } from "../UserManagement/ConfirmDialog";
import { OrganizationFormModal } from "./OrganizationFormModal";
import { countryLabel } from "../../data/userManagementOptions";
import { useResourceTable } from "./useResourceTable";
import { invalidateSharedFetch } from "../../hooks/useSharedFetch";

export function OrganizationsTab() {
  const { config, activeAccount } = useAnnotationContext();
  const authToken = activeAccount?.token;
  const organizationsKey = `organizations:${config.apiBaseUrl}:${authToken ?? ""}`;

  const {
    items: organizations,
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
  } = useResourceTable<Organization, OrganizationDraft>({
    load: (_query, signal) => fetchOrganizations(config.apiBaseUrl, authToken, signal),
    create: async (draft) => {
      const result = await createOrganization(config.apiBaseUrl, authToken, draft);
      invalidateSharedFetch(organizationsKey);
      return result;
    },
    update: async (id, draft) => {
      const result = await updateOrganization(config.apiBaseUrl, authToken, id, draft);
      invalidateSharedFetch(organizationsKey);
      return result;
    },
    remove: async (id) => {
      await deleteOrganization(config.apiBaseUrl, authToken, id);
      invalidateSharedFetch(organizationsKey);
    },
    getId: (organization) => organization.id,
    draftLabel: (draft) => draft.companyName,
    itemLabel: (organization) => organization.companyName,
    deps: [config.apiBaseUrl, authToken],
  });

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return organizations;
    }
    return organizations.filter(
      (organization) =>
        organization.companyName.toLowerCase().includes(needle) ||
        organization.slug.toLowerCase().includes(needle),
    );
  }, [organizations, query]);

  return (
    <div className="wpn-settings-tab">
      <ListSearchBar
        value={search}
        onValueChange={setSearch}
        onSubmit={() => setQuery(search)}
        onClear={() => {
          setSearch("");
          setQuery("");
        }}
        placeholder="Search organizations"
        trailing={
          <>
            <RefreshButton label="Refresh organizations" loading={loading} onRefresh={reload} />
            <button type="button" className="wpn-users-create" onClick={() => open()}>
              <Icon name="plus" className="wpn-users-create__icon" />
              New organization
            </button>
          </>
        }
      />

      {notice ? (
        <div className="wpn-users-notice" role="status">
          <span>{notice}</span>
          <button type="button" className="wpn-icon-btn" onClick={dismissNotice}>
            <Icon name="close" />
          </button>
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
              <th>Organization</th>
              <th>Slug</th>
              <th>Country</th>
              <th>Status</th>
              <th className="wpn-users-table__actions-head">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && !loaded ? (
              <TableSkeleton
                rows={5}
                columns={["identity", "text", "text", "pill", "actions"]}
                label="Loading organizations"
              />
            ) : loadError && organizations.length === 0 ? (
              <tr>
                <td colSpan={5} className="wpn-users-table__empty">
                  <Icon name="alert" className="wpn-users-table__empty-icon" />
                  <span>{loadError}</span>
                  <button type="button" className="wpn-btn wpn-btn--ghost" onClick={reload}>
                    Retry
                  </button>
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="wpn-users-table__empty">
                  <Icon name="building" className="wpn-users-table__empty-icon" />
                  <span>No organizations yet.</span>
                </td>
              </tr>
            ) : (
              visible.map((organization) => (
                <tr key={organization.id}>
                  <td>
                    <div className="wpn-users-identity">
                      <div className="wpn-users-identity__copy">
                        <span className="wpn-users-identity__name">{organization.companyName}</span>
                      </div>
                    </div>
                  </td>
                  <td className="wpn-users-muted">{organization.slug}</td>
                  <td className="wpn-users-muted">
                    {organization.countryCode ? countryLabel(organization.countryCode) : "—"}
                  </td>
                  <td>
                    <span
                      className={`wpn-users-pill wpn-users-pill--status-${organization.status}`}
                    >
                      {organization.status}
                    </span>
                  </td>
                  <td>
                    <div className="wpn-users-actions">
                      <Tooltip label="Edit" placement="left">
                        <button
                          type="button"
                          className="wpn-users-action"
                          aria-label={`Edit ${organization.companyName}`}
                          onClick={() => open(organization)}
                        >
                          <Icon name="edit" />
                        </button>
                      </Tooltip>
                      <Tooltip label="Delete" placement="left">
                        <button
                          type="button"
                          className="wpn-users-action wpn-users-action--danger"
                          aria-label={`Delete ${organization.companyName}`}
                          onClick={() => askDelete(organization)}
                        >
                          <Icon name="trash" />
                        </button>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {formOpen ? (
        <OrganizationFormModal
          organization={editTarget}
          busy={busy}
          fieldErrors={submitDetails?.fieldErrors ?? null}
          onCancel={closeForm}
          onSubmit={submit}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete organization"
          description={`${pendingDelete.companyName} and all of its projects will be permanently deleted.`}
          confirmLabel="Delete"
          confirmIcon="trash"
          destructive
          busy={busy}
          onCancel={cancelDelete}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}

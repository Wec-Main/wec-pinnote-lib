import { useCallback, useEffect, useMemo, useState } from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import {
  createOrganization,
  deleteOrganization,
  fetchOrganizations,
  updateOrganization,
} from "../../services/organizationsApi";
import type { Organization, OrganizationDraft } from "../../types/organization.types";
import { Icon, ListSearchBar, TableSkeleton, Tooltip } from "../primitives";
import { ConfirmDialog } from "../UserManagement/ConfirmDialog";
import { OrganizationFormModal } from "./OrganizationFormModal";
import { countryLabel } from "../../data/userManagementOptions";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function OrganizationsTab() {
  const { config, activeAccount } = useAnnotationContext();
  const actorId = activeAccount?.id;

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Organization | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Organization | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    fetchOrganizations(config.apiBaseUrl, actorId, controller.signal)
      .then((result) => {
        setOrganizations(result);
        setLoading(false);
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setLoadError(errorMessage(err));
        setLoading(false);
        setLoaded(true);
      });
    return () => controller.abort();
  }, [config.apiBaseUrl, actorId, reloadToken]);

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

  const submit = useCallback(
    async (draft: OrganizationDraft) => {
      setBusy(true);
      setNotice(null);
      try {
        if (editTarget) {
          await updateOrganization(config.apiBaseUrl, actorId, editTarget.id, draft);
          setNotice(`${draft.companyName} updated.`);
        } else {
          await createOrganization(config.apiBaseUrl, actorId, draft);
          setNotice(`${draft.companyName} created.`);
        }
        setFormOpen(false);
        setEditTarget(null);
        reload();
      } catch (err) {
        setNotice(errorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [config.apiBaseUrl, actorId, editTarget, reload],
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) {
      return;
    }
    setBusy(true);
    try {
      await deleteOrganization(config.apiBaseUrl, actorId, pendingDelete.id);
      setNotice(`${pendingDelete.companyName} deleted.`);
      setPendingDelete(null);
      reload();
    } catch (err) {
      setNotice(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [config.apiBaseUrl, actorId, pendingDelete, reload]);

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
          <button
            type="button"
            className="wpn-users-create"
            onClick={() => {
              setEditTarget(null);
              setFormOpen(true);
            }}
          >
            <Icon name="plus" className="wpn-users-create__icon" />
            New organization
          </button>
        }
      />

      {notice ? (
        <div className="wpn-users-notice" role="status">
          <span>{notice}</span>
          <button type="button" className="wpn-icon-btn" onClick={() => setNotice(null)}>
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
                          onClick={() => {
                            setEditTarget(organization);
                            setFormOpen(true);
                          }}
                        >
                          <Icon name="edit" />
                        </button>
                      </Tooltip>
                      <Tooltip label="Delete" placement="left">
                        <button
                          type="button"
                          className="wpn-users-action wpn-users-action--danger"
                          aria-label={`Delete ${organization.companyName}`}
                          onClick={() => setPendingDelete(organization)}
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
          onCancel={() => {
            setFormOpen(false);
            setEditTarget(null);
          }}
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
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}

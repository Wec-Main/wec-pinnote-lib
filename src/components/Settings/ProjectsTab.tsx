import { useCallback, useMemo, useState } from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import {
  createProject,
  deleteProject,
  fetchOrganizations,
  fetchProjects,
  updateProject,
} from "../../services/organizationsApi";
import type { Organization, Project, ProjectDraft } from "../../types/organization.types";
import { invalidateSharedFetch, useSharedFetch } from "../../hooks/useSharedFetch";
import {
  Icon,
  ListSearchBar,
  ModalShell,
  RefreshButton,
  SearchableSelect,
  TablePagination,
  TableSkeleton,
  Tooltip,
} from "../primitives";
import { ConfirmDialog } from "../UserManagement/ConfirmDialog";
import { ProjectFormModal } from "./ProjectFormModal";
import { ProjectVersionsPanel } from "./ProjectVersionsPanel";
import { useClientPagination } from "../../hooks/useClientPagination";
import { useResourceTable } from "./useResourceTable";
import { projectsTableKey } from "./settingsCache";
import { canManageProjects } from "../../utils/permissions";
import { projectVersionListKey } from "../../hooks/useProjectVersionList";

export function ProjectsTab() {
  const { config, activeAccount, reloadCurrentProjectVersion } = useAnnotationContext();
  const authToken = activeAccount?.token;
  const manageable = canManageProjects(activeAccount?.roleId ?? "developer");
  const columnCount = manageable ? 5 : 3;

  const [organizationFilter, setOrganizationFilter] = useState("");
  const [versionsTarget, setVersionsTarget] = useState<Project | null>(null);
  const organizationsKey = `organizations:${config.apiBaseUrl}:${authToken ?? ""}`;
  const { data: organizations } = useSharedFetch<Organization[]>(
    manageable ? organizationsKey : null,
    (signal) => fetchOrganizations(config.apiBaseUrl, authToken, signal),
  );
  const organizationList = useMemo(() => organizations ?? [], [organizations]);

  const invalidateProjectCaches = useCallback(() => {
    invalidateSharedFetch(`projects:${config.apiBaseUrl}:${authToken ?? ""}:all`);
    invalidateSharedFetch(
      `projects:${config.apiBaseUrl}:${authToken ?? ""}:${activeAccount?.organizationId ?? ""}`,
    );
  }, [config.apiBaseUrl, authToken, activeAccount?.organizationId]);

  const {
    items: projects,
    loading,
    refreshing,
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
  } = useResourceTable<Project, ProjectDraft>({
    load: (_query, signal) =>
      fetchProjects(config.apiBaseUrl, authToken, organizationFilter || undefined, signal),
    create: async (draft) => {
      const result = await createProject(config.apiBaseUrl, authToken, draft);
      invalidateProjectCaches();
      return result;
    },
    update: async (id, draft) => {
      const result = await updateProject(config.apiBaseUrl, authToken, id, draft);
      invalidateProjectCaches();
      return result;
    },
    remove: async (id) => {
      await deleteProject(config.apiBaseUrl, authToken, id);
      invalidateProjectCaches();
    },
    getId: (project) => project.id,
    draftLabel: (draft) => draft.name,
    itemLabel: (project) => project.name,
    deps: [config.apiBaseUrl, authToken, organizationFilter],
    cacheKey: projectsTableKey(config.apiBaseUrl, authToken, organizationFilter),
  });

  const organizationName = useCallback(
    (organizationId: string) =>
      organizationList.find((organization) => organization.id === organizationId)?.companyName ??
      organizationId,
    [organizationList],
  );

  const organizationOptions = useMemo(
    () =>
      organizationList.map((organization) => ({
        value: organization.id,
        label: organization.companyName,
      })),
    [organizationList],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return projects;
    }
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(needle) || project.id.toLowerCase().includes(needle),
    );
  }, [projects, query]);
  const { pageItems, paginationProps } = useClientPagination(visible);

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
        placeholder="Search projects"
        trailing={
          manageable ? (
            <>
              <SearchableSelect
                options={organizationOptions}
                value={organizationFilter}
                onChange={setOrganizationFilter}
                ariaLabel="Filter by organization"
                placeholder="All organizations"
                clearable
                size="sm"
              />
              <RefreshButton label="Refresh projects" loading={loading || refreshing} onRefresh={reload} />
              <button
                type="button"
                className="wpn-users-create"
                disabled={organizationList.length === 0}
                onClick={() => open()}
              >
                <Icon name="plus" className="wpn-users-create__icon" />
                New project
              </button>
            </>
          ) : (
            <RefreshButton label="Refresh projects" loading={loading || refreshing} onRefresh={reload} />
          )
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

      <div className="wpn-table-card">
        <div className="wpn-users-table-wrap">
          <table
            className={["wpn-users-table", loading && loaded ? "wpn-users-table--refetching" : ""]
              .filter(Boolean)
              .join(" ")}
          >
            <thead>
              <tr>
                <th>Project</th>
                {manageable ? <th>Organization</th> : null}
                <th>Status</th>
                <th className="wpn-users-table__version-settings-head">Version Settings</th>
                {manageable ? <th className="wpn-users-table__actions-head">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {loading && !loaded ? (
                <TableSkeleton
                  rows={5}
                  columns={
                    manageable
                      ? ["identity", "text", "pill", "actions", "actions"]
                      : ["identity", "pill", "actions"]
                  }
                  label="Loading projects"
                />
              ) : loadError && projects.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="wpn-users-table__empty">
                    <Icon name="alert" className="wpn-users-table__empty-icon" />
                    <span>{loadError}</span>
                    <button type="button" className="wpn-btn wpn-btn--ghost" onClick={reload}>
                      Retry
                    </button>
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="wpn-users-table__empty">
                    <Icon name="folder" className="wpn-users-table__empty-icon" />
                    <span>
                      {!manageable
                        ? "No projects are assigned to you yet."
                        : organizationList.length === 0
                          ? "Create an organization before adding projects."
                          : "No projects yet."}
                    </span>
                  </td>
                </tr>
              ) : (
                pageItems.map((project) => (
                  <tr key={project.id}>
                    <td>
                      <div className="wpn-users-identity">
                        <div className="wpn-users-identity__copy">
                          <span className="wpn-users-identity__name">{project.name}</span>
                          <span className="wpn-users-identity__email">{project.id}</span>
                        </div>
                      </div>
                    </td>
                    {manageable ? (
                      <td className="wpn-users-muted">
                        {organizationName(project.organizationId)}
                      </td>
                    ) : null}
                    <td>
                      <span className={`wpn-users-pill wpn-users-pill--status-${project.status}`}>
                        {project.status}
                      </span>
                    </td>
                    <td className="wpn-users-table__version-settings-cell">
                      <Tooltip label="Version settings" placement="left">
                        <button
                          type="button"
                          className="wpn-icon-btn"
                          aria-label={`Version settings for ${project.name}`}
                          onClick={() => setVersionsTarget(project)}
                        >
                          <Icon name="settings" />
                        </button>
                      </Tooltip>
                    </td>
                    {manageable ? (
                      <td>
                        <div className="wpn-users-actions">
                          <Tooltip label="Edit" placement="left">
                            <button
                              type="button"
                              className="wpn-users-action wpn-users-action--primary"
                              aria-label={`Edit ${project.name}`}
                              onClick={() => open(project)}
                            >
                              <Icon name="edit" />
                            </button>
                          </Tooltip>
                          <Tooltip label="Delete" placement="left">
                            <button
                              type="button"
                              className="wpn-users-action wpn-users-action--danger"
                              aria-label={`Delete ${project.name}`}
                              onClick={() => askDelete(project)}
                            >
                              <Icon name="trash" />
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <TablePagination {...paginationProps} itemLabel="projects" />
      </div>

      {formOpen ? (
        <ProjectFormModal
          project={editTarget}
          organizations={organizationList}
          defaultOrganizationId={organizationFilter || undefined}
          busy={busy}
          fieldErrors={submitDetails?.fieldErrors ?? null}
          onCancel={closeForm}
          onSubmit={submit}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete project"
          description={`${pendingDelete.name} and all of its annotations will be permanently deleted.`}
          confirmLabel="Delete"
          confirmIcon="trash"
          destructive
          busy={busy}
          onCancel={cancelDelete}
          onConfirm={confirmDelete}
        />
      ) : null}

      {versionsTarget ? (
        <ModalShell
          title={`${versionsTarget.name} — Versions`}
          onClose={() => setVersionsTarget(null)}
        >
          <ProjectVersionsPanel
            apiBaseUrl={config.apiBaseUrl}
            authToken={authToken}
            projectId={versionsTarget.id}
            showVersionSettings={manageable}
            onVersionChanged={() => {
              if (activeAccount) {
                invalidateSharedFetch(
                  projectVersionListKey(config.apiBaseUrl, activeAccount.id, versionsTarget.id),
                );
              }
              if (versionsTarget.id === config.projectId) {
                reloadCurrentProjectVersion();
              }
            }}
          />
        </ModalShell>
      ) : null}
    </div>
  );
}

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
  RefreshButton,
  SearchableSelect,
  TableSkeleton,
  Tooltip,
} from "../primitives";
import { ConfirmDialog } from "../UserManagement/ConfirmDialog";
import { ProjectFormModal } from "./ProjectFormModal";
import { useResourceTable } from "./useResourceTable";

export function ProjectsTab() {
  const { config, activeAccount } = useAnnotationContext();
  const authToken = activeAccount?.token;

  const [organizationFilter, setOrganizationFilter] = useState("");
  const organizationsKey = `organizations:${config.apiBaseUrl}:${authToken ?? ""}`;
  const { data: organizations } = useSharedFetch<Organization[]>(organizationsKey, (signal) =>
    fetchOrganizations(config.apiBaseUrl, authToken, signal),
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
      const { projectId: _projectId, ...rest } = draft;
      const result = await updateProject(config.apiBaseUrl, authToken, id, rest);
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
            <RefreshButton label="Refresh projects" loading={loading} onRefresh={reload} />
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
              <th>Project</th>
              <th>Organization</th>
              <th>Status</th>
              <th className="wpn-users-table__actions-head">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && !loaded ? (
              <TableSkeleton
                rows={5}
                columns={["identity", "text", "pill", "actions"]}
                label="Loading projects"
              />
            ) : loadError && projects.length === 0 ? (
              <tr>
                <td colSpan={4} className="wpn-users-table__empty">
                  <Icon name="alert" className="wpn-users-table__empty-icon" />
                  <span>{loadError}</span>
                  <button type="button" className="wpn-btn wpn-btn--ghost" onClick={reload}>
                    Retry
                  </button>
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={4} className="wpn-users-table__empty">
                  <Icon name="folder" className="wpn-users-table__empty-icon" />
                  <span>
                    {organizationList.length === 0
                      ? "Create an organization before adding projects."
                      : "No projects yet."}
                  </span>
                </td>
              </tr>
            ) : (
              visible.map((project) => (
                <tr key={project.id}>
                  <td>
                    <div className="wpn-users-identity">
                      <div className="wpn-users-identity__copy">
                        <span className="wpn-users-identity__name">{project.name}</span>
                        <span className="wpn-users-identity__email">{project.id}</span>
                      </div>
                    </div>
                  </td>
                  <td className="wpn-users-muted">{organizationName(project.organizationId)}</td>
                  <td>
                    <span className={`wpn-users-pill wpn-users-pill--status-${project.status}`}>
                      {project.status}
                    </span>
                  </td>
                  <td>
                    <div className="wpn-users-actions">
                      <Tooltip label="Edit" placement="left">
                        <button
                          type="button"
                          className="wpn-users-action"
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
                </tr>
              ))
            )}
          </tbody>
        </table>
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
    </div>
  );
}

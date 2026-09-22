import { useCallback, useEffect, useMemo, useState } from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import {
  createProject,
  deleteProject,
  fetchOrganizations,
  fetchProjects,
  updateProject,
} from "../../services/organizationsApi";
import type { Organization, Project, ProjectDraft } from "../../types/organization.types";
import { Icon, ListSearchBar, SearchableSelect, TableSkeleton, Tooltip } from "../primitives";
import { ConfirmDialog } from "../UserManagement/ConfirmDialog";
import { ProjectFormModal } from "./ProjectFormModal";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function ProjectsTab() {
  const { config, activeAccount } = useAnnotationContext();
  const actorId = activeAccount?.id;

  const [projects, setProjects] = useState<Project[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationFilter, setOrganizationFilter] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    fetchOrganizations(config.apiBaseUrl, actorId, controller.signal)
      .then(setOrganizations)
      .catch(() => undefined);
    return () => controller.abort();
  }, [config.apiBaseUrl, actorId, reloadToken]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    fetchProjects(config.apiBaseUrl, actorId, organizationFilter || undefined, controller.signal)
      .then((result) => {
        setProjects(result);
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
  }, [config.apiBaseUrl, actorId, organizationFilter, reloadToken]);

  const organizationName = useCallback(
    (organizationId: string) =>
      organizations.find((organization) => organization.id === organizationId)?.companyName ??
      organizationId,
    [organizations],
  );

  const organizationOptions = useMemo(
    () =>
      organizations.map((organization) => ({
        value: organization.id,
        label: organization.companyName,
      })),
    [organizations],
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

  const submit = useCallback(
    async (draft: ProjectDraft) => {
      setBusy(true);
      setNotice(null);
      try {
        if (editTarget) {
          const { projectId: _projectId, ...rest } = draft;
          await updateProject(config.apiBaseUrl, actorId, editTarget.id, rest);
          setNotice(`${draft.name} updated.`);
        } else {
          await createProject(config.apiBaseUrl, actorId, draft);
          setNotice(`${draft.name} created.`);
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
      await deleteProject(config.apiBaseUrl, actorId, pendingDelete.id);
      setNotice(`${pendingDelete.name} deleted.`);
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
            <button
              type="button"
              className="wpn-users-create"
              disabled={organizations.length === 0}
              onClick={() => {
                setEditTarget(null);
                setFormOpen(true);
              }}
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
                    {organizations.length === 0
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
                          onClick={() => {
                            setEditTarget(project);
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
                          aria-label={`Delete ${project.name}`}
                          onClick={() => setPendingDelete(project)}
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
          organizations={organizations}
          defaultOrganizationId={organizationFilter || undefined}
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
          title="Delete project"
          description={`${pendingDelete.name} and all of its annotations will be permanently deleted.`}
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

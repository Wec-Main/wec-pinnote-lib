import { useCallback, useMemo, useState } from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { fetchProjects } from "../../services/organizationsApi";
import { createTag, deleteTag, fetchTags, updateTag } from "../../services/tagsApi";
import { formatTimestamp } from "../../utils/format";
import type { Project } from "../../types/organization.types";
import type { ProjectTag, TagDraft } from "../../types/tag.types";
import { useSharedFetch } from "../../hooks/useSharedFetch";
import {
  Icon,
  ListSearchBar,
  RefreshButton,
  SearchableSelect,
  TableSkeleton,
  Tooltip,
} from "../primitives";
import { ConfirmDialog } from "../UserManagement/ConfirmDialog";
import { TagFormModal } from "./TagFormModal";
import { TagDetailsModal } from "./TagDetailsModal";
import { useResourceTable } from "./useResourceTable";
import { TAG_STATUS_OPTIONS } from "./tagOptions";

export function TagsTab() {
  const { config, activeAccount } = useAnnotationContext();
  const authToken = activeAccount?.token;

  const [projectFilter, setProjectFilter] = useState("");
  const projectsKey = `projects:${config.apiBaseUrl}:${authToken ?? ""}:all`;
  const { data: projectsData } = useSharedFetch<Project[]>(projectsKey, (signal) =>
    fetchProjects(config.apiBaseUrl, authToken, undefined, signal),
  );
  const projects = useMemo(() => projectsData ?? [], [projectsData]);
  const [statusFilter, setStatusFilter] = useState("");
  const [viewTarget, setViewTarget] = useState<ProjectTag | null>(null);

  const {
    items: tags,
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
  } = useResourceTable<ProjectTag, TagDraft>({
    load: (_query, signal) =>
      fetchTags(
        config.apiBaseUrl,
        authToken,
        { projectId: projectFilter || undefined, status: statusFilter || undefined },
        signal,
      ),
    create: (draft) => createTag(config.apiBaseUrl, authToken, draft),
    update: (id, draft) => {
      const { projectId: _projectId, ...rest } = draft;
      return updateTag(config.apiBaseUrl, authToken, id, rest);
    },
    remove: (id) => deleteTag(config.apiBaseUrl, authToken, id),
    getId: (tag) => tag.id,
    draftLabel: (draft) => draft.name,
    itemLabel: (tag) => tag.name,
    deps: [config.apiBaseUrl, authToken, projectFilter, statusFilter],
  });

  const projectName = useCallback(
    (projectId: string) => projects.find((project) => project.id === projectId)?.name ?? projectId,
    [projects],
  );

  const projectOptions = useMemo(
    () => projects.map((project) => ({ value: project.id, label: project.name })),
    [projects],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return tags;
    }
    return tags.filter(
      (tag) =>
        tag.name.toLowerCase().includes(needle) ||
        (tag.createdByName ?? "").toLowerCase().includes(needle),
    );
  }, [tags, query]);

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
        placeholder="Search tags"
        trailing={
          <>
            <SearchableSelect
              options={projectOptions}
              value={projectFilter}
              onChange={setProjectFilter}
              ariaLabel="Filter by project"
              placeholder="All projects"
              clearable
              size="sm"
            />
            <SearchableSelect
              options={TAG_STATUS_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
              ariaLabel="Filter by status"
              placeholder="All statuses"
              clearable
              size="sm"
            />
            <RefreshButton label="Refresh tags" loading={loading} onRefresh={reload} />
            <button
              type="button"
              className="wpn-users-create"
              disabled={projects.length === 0}
              onClick={() => open()}
            >
              <Icon name="plus" className="wpn-users-create__icon" />
              New tag
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
              <th>Tag name</th>
              <th>Colour</th>
              <th>Created by</th>
              <th>Updated on</th>
              <th>Status</th>
              <th className="wpn-users-table__actions-head">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && !loaded ? (
              <TableSkeleton
                rows={5}
                columns={["identity", "pill", "text", "text", "pill", "actions"]}
                label="Loading tags"
              />
            ) : loadError && tags.length === 0 ? (
              <tr>
                <td colSpan={6} className="wpn-users-table__empty">
                  <Icon name="alert" className="wpn-users-table__empty-icon" />
                  <span>{loadError}</span>
                  <button type="button" className="wpn-btn wpn-btn--ghost" onClick={reload}>
                    Retry
                  </button>
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="wpn-users-table__empty">
                  <Icon name="folder" className="wpn-users-table__empty-icon" />
                  <span>
                    {projects.length === 0
                      ? "Create a project before adding tags."
                      : "No tags yet."}
                  </span>
                </td>
              </tr>
            ) : (
              visible.map((tag) => (
                <tr key={tag.id}>
                  <td>
                    <div className="wpn-users-identity">
                      <span className="wpn-tag-dot" style={{ backgroundColor: tag.color }} />
                      <div className="wpn-users-identity__copy">
                        <span className="wpn-users-identity__name">{tag.name}</span>
                        <span className="wpn-users-identity__email">
                          {projectName(tag.projectId)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="wpn-tag-chip" style={{ backgroundColor: tag.color }}>
                      {tag.color}
                    </span>
                  </td>
                  <td className="wpn-users-muted">{tag.createdByName ?? "—"}</td>
                  <td className="wpn-users-muted">{formatTimestamp(tag.updatedAt)}</td>
                  <td>
                    <span className={`wpn-users-pill wpn-users-pill--status-${tag.status}`}>
                      {tag.status}
                    </span>
                  </td>
                  <td>
                    <div className="wpn-users-actions">
                      <Tooltip label="View" placement="left">
                        <button
                          type="button"
                          className="wpn-users-action"
                          aria-label={`View ${tag.name}`}
                          onClick={() => setViewTarget(tag)}
                        >
                          <Icon name="eye" />
                        </button>
                      </Tooltip>
                      <Tooltip label="Edit" placement="left">
                        <button
                          type="button"
                          className="wpn-users-action"
                          aria-label={`Edit ${tag.name}`}
                          onClick={() => open(tag)}
                        >
                          <Icon name="edit" />
                        </button>
                      </Tooltip>
                      <Tooltip label="Delete" placement="left">
                        <button
                          type="button"
                          className="wpn-users-action wpn-users-action--danger"
                          aria-label={`Delete ${tag.name}`}
                          onClick={() => askDelete(tag)}
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
        <TagFormModal
          tag={editTarget}
          projects={projects}
          defaultProjectId={projectFilter || undefined}
          busy={busy}
          fieldErrors={submitDetails?.fieldErrors ?? null}
          onCancel={closeForm}
          onSubmit={submit}
        />
      ) : null}

      {viewTarget ? (
        <TagDetailsModal
          tag={viewTarget}
          projectName={projectName(viewTarget.projectId)}
          onClose={() => setViewTarget(null)}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete tag"
          description={`${pendingDelete.name} will be permanently removed from ${projectName(pendingDelete.projectId)}.`}
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

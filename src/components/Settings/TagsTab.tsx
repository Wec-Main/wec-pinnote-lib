import { useCallback, useEffect, useMemo, useState } from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { fetchProjects } from "../../services/organizationsApi";
import { createTag, deleteTag, fetchTags, updateTag } from "../../services/tagsApi";
import type { Project } from "../../types/organization.types";
import type { ProjectTag, TagDraft } from "../../types/tag.types";
import { Icon, ListSearchBar, SearchableSelect, TableSkeleton, Tooltip } from "../primitives";
import { ConfirmDialog } from "../UserManagement/ConfirmDialog";
import { TagFormModal } from "./TagFormModal";
import { TagDetailsModal } from "./TagDetailsModal";

const STATUS_FILTER_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function formatUpdatedOn(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function TagsTab() {
  const { config, activeAccount } = useAnnotationContext();
  const actorId = activeAccount?.id;

  const [tags, setTags] = useState<ProjectTag[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectFilter, setProjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProjectTag | null>(null);
  const [viewTarget, setViewTarget] = useState<ProjectTag | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProjectTag | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    fetchProjects(config.apiBaseUrl, actorId, undefined, controller.signal)
      .then(setProjects)
      .catch(() => undefined);
    return () => controller.abort();
  }, [config.apiBaseUrl, actorId, reloadToken]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    fetchTags(
      config.apiBaseUrl,
      actorId,
      { projectId: projectFilter || undefined, status: statusFilter || undefined },
      controller.signal,
    )
      .then((result) => {
        setTags(result);
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
  }, [config.apiBaseUrl, actorId, projectFilter, statusFilter, reloadToken]);

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

  const submit = useCallback(
    async (draft: TagDraft) => {
      setBusy(true);
      setNotice(null);
      try {
        if (editTarget) {
          const { projectId: _projectId, ...rest } = draft;
          await updateTag(config.apiBaseUrl, actorId, editTarget.id, rest);
          setNotice(`${draft.name} updated.`);
        } else {
          await createTag(config.apiBaseUrl, actorId, draft);
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
      await deleteTag(config.apiBaseUrl, actorId, pendingDelete.id);
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
              options={STATUS_FILTER_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
              ariaLabel="Filter by status"
              placeholder="All statuses"
              clearable
              size="sm"
            />
            <button
              type="button"
              className="wpn-users-create"
              disabled={projects.length === 0}
              onClick={() => {
                setEditTarget(null);
                setFormOpen(true);
              }}
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
                  <td className="wpn-users-muted">{formatUpdatedOn(tag.updatedAt)}</td>
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
                          onClick={() => {
                            setEditTarget(tag);
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
                          aria-label={`Delete ${tag.name}`}
                          onClick={() => setPendingDelete(tag)}
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
          onCancel={() => {
            setFormOpen(false);
            setEditTarget(null);
          }}
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
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}

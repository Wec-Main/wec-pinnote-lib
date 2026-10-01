import { useCallback, useMemo, useState } from "react";
import { useAnnotationAuth, useAnnotationContext } from "../../context/AnnotationContext";
import {
  Icon,
  ListSearchBar,
  RefreshButton,
  TablePagination,
  TableSkeleton,
  Tooltip,
} from "../primitives";
import { AuthorBadge } from "../EpicFlow/AuthorBadge";
import { ConfirmDialog } from "../UserManagement/ConfirmDialog";
import { useSharedFetch, invalidateSharedFetch } from "../../hooks/useSharedFetch";
import { useTokenGetter } from "../../hooks/useTokenGetter";
import { useDataModelStream } from "../../hooks/useDataModelStream";
import type { StreamEvent } from "../../types/stream.types";
import {
  createDataModel,
  deleteDataModel,
  listDataModels,
} from "../../services/dataModelApi";
import { canDeleteBoardItem } from "../../utils/boardPermissions";
import { formatRelativeTime } from "../../utils/format";
import type { DataModel, DataModelDraft } from "../../types/dataModel.types";
import { DATA_MODEL_ENGINE_OPTIONS, DataModelFormModal } from "./DataModelFormModal";

const DEFAULT_PAGE_SIZE = 10;
const COLUMN_COUNT = 6;

function describeApiError(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Could not reach the Data Model API.";
}

function engineLabel(engine: DataModel["engine"]): string {
  return DATA_MODEL_ENGINE_OPTIONS.find((option) => option.value === engine)?.label ?? engine;
}

function matchesSearch(dataModel: DataModel, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return true;
  }
  return [dataModel.name, dataModel.description, dataModel.createdByUser, dataModel.engine].some(
    (value) => value.toLowerCase().includes(needle),
  );
}

interface DataModelListPanelProps {
  onOpen: (dataModelId: string) => void;
}


export function DataModelListPanel({ onOpen }: DataModelListPanelProps) {
  const { config } = useAnnotationContext();
  const { hostAuthenticated, activeAccount } = useAnnotationAuth();
  const getToken = useTokenGetter(config.getAuthToken);
  const sessionKey = hostAuthenticated ? "host" : (activeAccount?.id ?? "");
  const listKey = sessionKey
    ? `data-models-list:${config.apiBaseUrl}:${sessionKey}:${config.projectId}`
    : null;

  const {
    data: dataModels,
    loading,
    error,
    reload,
  } = useSharedFetch(listKey, (signal) =>
    getToken().then((authToken) =>
      listDataModels(config.apiBaseUrl, authToken, config.projectId, signal),
    ),
  );

  const [pendingDelete, setPendingDelete] = useState<DataModel | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const refresh = useCallback(() => {
    if (listKey) {
      invalidateSharedFetch(listKey);
    }
    reload();
  }, [listKey, reload]);

  const onStreamEvent = useCallback(
    (event: StreamEvent) => {
      if (event.eventType !== "data_model_document.saved") {
        refresh();
      }
    },
    [refresh],
  );

  useDataModelStream({
    apiBaseUrl: config.apiBaseUrl,
    projectId: config.projectId,
    getAuthToken: config.getAuthToken,
    sessionKey,
    enabled: Boolean(sessionKey),
    onEvent: onStreamEvent,
    onResync: refresh,
  });

  const filtered = useMemo(
    () => (dataModels ?? []).filter((dataModel) => matchesSearch(dataModel, searchQuery)),
    [dataModels, searchQuery],
  );
  const lastPage = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, lastPage);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const closeForm = () => {
    setFormOpen(false);
    setFormError(null);
  };

  const handleSubmitForm = async (draft: DataModelDraft) => {
    setBusy(true);
    setFormError(null);
    try {
      const authToken = await getToken();
      const created = await createDataModel(config.apiBaseUrl, authToken, config.projectId, draft);
      refresh();
      closeForm();
      onOpen(created.id);
    } catch (err) {
      setFormError(describeApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const authToken = await getToken();
      await deleteDataModel(config.apiBaseUrl, authToken, pendingDelete.id);
      setNotice("Data model deleted.");
      refresh();
      setPendingDelete(null);
    } catch (err) {
      setNotice(describeApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
    setPage(1);
  };

  const renderBody = () => {
    if (loading && !dataModels) {
      return (
        <TableSkeleton
          rows={5}
          columns={["identity", "text", "text", "text", "text", "actions"]}
          label="Loading data models..."
        />
      );
    }
    if (error && !dataModels) {
      return (
        <tr>
          <td colSpan={COLUMN_COUNT} className="wpn-users-table__empty">
            <span>{describeApiError(error)}</span>
            <button type="button" className="wpn-btn wpn-btn--ghost" onClick={refresh}>
              <Icon name="refresh" className="wpn-btn__icon" />
              Retry
            </button>
          </td>
        </tr>
      );
    }
    if (visible.length === 0) {
      return (
        <tr>
          <td colSpan={COLUMN_COUNT} className="wpn-users-table__empty">
            <Icon name="dataModel" className="wpn-users-table__empty-icon" />
            <span>
              {searchQuery
                ? "No data models match your search."
                : "No data models in this project yet."}
            </span>
            {searchQuery ? (
              <button type="button" className="wpn-btn wpn-btn--ghost" onClick={clearSearch}>
                <Icon name="refresh" className="wpn-btn__icon" />
                Clear search
              </button>
            ) : null}
          </td>
        </tr>
      );
    }
    return visible.map((dataModel) => (
      <tr key={dataModel.id}>
        <td>
          <button
            type="button"
            className="wpn-users-identity wpn-flow-list-tab__open"
            aria-label={`Open ${dataModel.name}`}
            onClick={() => onOpen(dataModel.id)}
          >
            <span className="wpn-avatar wpn-avatar--fallback wpn-flow-list-tab__avatar">
              <Icon name="dataModel" />
            </span>
            <span className="wpn-users-identity__copy">
              <span className="wpn-users-identity__name wpn-flow-list-tab__name">
                {dataModel.name}
              </span>
              <span className="wpn-users-identity__email">
                {dataModel.description || "No description"}
              </span>
            </span>
          </button>
        </td>
        <td>
          <span
            className={`wpn-datamodel-engine-badge wpn-datamodel-engine-badge--${dataModel.engine}`}
          >
            {engineLabel(dataModel.engine)}
          </span>
        </td>
        <td className="wpn-users-table__muted wpn-flow-list-tab__nodes">
          {dataModel.entityCount ?? 0}
        </td>
        <td>
          <AuthorBadge name={dataModel.createdByUser} />
        </td>
        <td className="wpn-users-table__muted">
          <Tooltip label={new Date(dataModel.updatedAt).toLocaleString()} placement="bottom">
            <span>{formatRelativeTime(dataModel.updatedAt)}</span>
          </Tooltip>
        </td>
        <td>
          <div className="wpn-users-actions">
            <button
              type="button"
              className="wpn-users-action wpn-users-action--labeled"
              aria-label={`Open ${dataModel.name}`}
              onClick={() => onOpen(dataModel.id)}
            >
              <Icon name="open" />
              <span>Open</span>
            </button>
            {canDeleteBoardItem(dataModel.createdById, config.currentUser) ? (
              <button
                type="button"
                className="wpn-users-action wpn-users-action--labeled wpn-users-action--danger"
                aria-label={`Delete ${dataModel.name}`}
                onClick={() => setPendingDelete(dataModel)}
              >
                <Icon name="trash" />
                <span>Delete</span>
              </button>
            ) : null}
          </div>
        </td>
      </tr>
    ));
  };

  return (
    <div className="wpn-settings-tab wpn-flow-list-tab wpn-datamodel-list-tab">
      <ListSearchBar
        value={searchInput}
        onValueChange={setSearchInput}
        onSubmit={() => {
          setSearchQuery(searchInput);
          setPage(1);
        }}
        onClear={clearSearch}
        placeholder="Search data model name, engine or author"
        trailing={
          <>
            <RefreshButton label="Refresh data models" loading={loading} onRefresh={refresh} />
            <button
              type="button"
              className="wpn-users-create"
              onClick={() => setFormOpen(true)}
            >
              <Icon name="plus" className="wpn-users-create__icon" />
              Create Data Model
            </button>
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
          className={["wpn-users-table", loading && dataModels ? "wpn-users-table--refetching" : ""]
            .filter(Boolean)
            .join(" ")}
        >
          <colgroup>
            <col className="wpn-flow-list-tab__col-name" />
            <col className="wpn-datamodel-list-tab__col-engine" />
            <col className="wpn-flow-list-tab__col-nodes" />
            <col />
            <col />
            <col className="wpn-datamodel-list-tab__col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Engine</th>
              <th scope="col" className="wpn-flow-list-tab__nodes">
                Entities
              </th>
              <th scope="col">Created by</th>
              <th scope="col">Last updated</th>
              <th scope="col" className="wpn-users-table__actions-head">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>{renderBody()}</tbody>
        </table>
      </div>

      <TablePagination
        page={currentPage}
        pageSize={pageSize}
        totalItems={filtered.length}
        itemLabel="data models"
        onPageChange={setPage}
        onPageSizeChange={(next) => {
          setPageSize(next);
          setPage(1);
        }}
      />

      {formOpen ? (
        <DataModelFormModal
          dataModel={null}
          busy={busy}
          error={formError}
          onCancel={closeForm}
          onSubmit={handleSubmitForm}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete data model"
          description={`Delete "${pendingDelete.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          confirmIcon="trash"
          destructive
          busy={busy}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      ) : null}
    </div>
  );
}

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
import { useFlowStream } from "../../hooks/useFlowStream";
import type { StreamEvent } from "../../types/stream.types";
import { deleteFlow, listFlows } from "../../services/flowApi";
import { canDeleteBoardItem } from "../../utils/boardPermissions";
import { formatRelativeTime } from "../../utils/format";
import type { Flow } from "../../types/flowPin.types";

const DEFAULT_PAGE_SIZE = 10;
const COLUMN_COUNT = 5;

function describeApiError(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Could not reach the Flow API.";
}

interface FlowListPanelProps {
  onOpen: (flowId: string) => void;
}

function belongsToOtherVersion(event: StreamEvent, projectVersionId: string | undefined): boolean {
  if (event.eventType !== "flow.created" && event.eventType !== "flow.updated") {
    return false;
  }
  const eventVersionId = event.payload.flow.projectVersionId;
  return Boolean(projectVersionId && eventVersionId && eventVersionId !== projectVersionId);
}

function matchesSearch(flow: Flow, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return true;
  }
  return [flow.name, flow.createdByUser, flow.pinPageKey ?? ""].some((value) =>
    value.toLowerCase().includes(needle),
  );
}

export function FlowListPanel({ onOpen }: FlowListPanelProps) {
  const { config, flowsVersionId } = useAnnotationContext();
  const { hostAuthenticated, activeAccount } = useAnnotationAuth();
  const getToken = useTokenGetter(config.getAuthToken);
  const sessionKey = hostAuthenticated ? "host" : (activeAccount?.id ?? "");
  const flowsKey = sessionKey
    ? `flows-list:${config.apiBaseUrl}:${sessionKey}:${config.projectId}:${flowsVersionId ?? ""}`
    : null;

  const {
    data: flows,
    loading,
    error,
    reload,
  } = useSharedFetch(flowsKey, (signal) =>
    getToken().then((authToken) =>
      listFlows(config.apiBaseUrl, authToken, config.projectId, flowsVersionId, signal),
    ),
  );

  const [pendingDelete, setPendingDelete] = useState<Flow | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const refresh = useCallback(() => {
    if (flowsKey) {
      invalidateSharedFetch(flowsKey);
    }
    reload();
  }, [flowsKey, reload]);

  const onStreamEvent = useCallback(
    (event: StreamEvent) => {
      if (!belongsToOtherVersion(event, flowsVersionId)) {
        refresh();
      }
    },
    [flowsVersionId, refresh],
  );

  useFlowStream({
    apiBaseUrl: config.apiBaseUrl,
    projectId: config.projectId,
    getAuthToken: config.getAuthToken,
    sessionKey,
    enabled: Boolean(sessionKey),
    onEvent: onStreamEvent,
    onResync: refresh,
  });

  const filtered = useMemo(
    () => (flows ?? []).filter((flow) => matchesSearch(flow, searchQuery)),
    [flows, searchQuery],
  );
  const lastPage = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, lastPage);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleConfirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const authToken = await getToken();
      await deleteFlow(config.apiBaseUrl, authToken, pendingDelete.id);
      setNotice("Flow deleted.");
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
    if (loading && !flows) {
      return (
        <TableSkeleton
          rows={5}
          columns={["identity", "text", "text", "text", "actions"]}
          label="Loading flows..."
        />
      );
    }
    if (error && !flows) {
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
            <Icon name="flow" className="wpn-users-table__empty-icon" />
            <span>
              {searchQuery ? "No flows match your search." : "No flows in this version yet."}
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
    return visible.map((flow) => (
      <tr key={flow.id}>
        <td>
          <button
            type="button"
            className="wpn-users-identity wpn-flow-list-tab__open"
            aria-label={`Open ${flow.name}`}
            onClick={() => onOpen(flow.id)}
          >
            <span className="wpn-avatar wpn-avatar--fallback wpn-flow-list-tab__avatar">
              <Icon name="flow" />
            </span>
            <span className="wpn-users-identity__copy">
              <span className="wpn-users-identity__name wpn-flow-list-tab__name">{flow.name}</span>
              <span className="wpn-users-identity__email">
                {flow.pinPageKey ? `Pinned on ${flow.pinPageKey}` : "Not pinned"}
              </span>
            </span>
          </button>
        </td>
        <td className="wpn-users-table__muted wpn-flow-list-tab__nodes">{flow.nodeCount ?? 0}</td>
        <td>
          <AuthorBadge name={flow.createdByUser} />
        </td>
        <td className="wpn-users-table__muted">
          <Tooltip label={new Date(flow.updatedAt).toLocaleString()} placement="bottom">
            <span>{formatRelativeTime(flow.updatedAt)}</span>
          </Tooltip>
        </td>
        <td>
          <div className="wpn-users-actions">
            <button
              type="button"
              className="wpn-users-action wpn-users-action--labeled"
              aria-label={`Edit ${flow.name}`}
              onClick={() => onOpen(flow.id)}
            >
              <Icon name="edit" />
              <span>Edit</span>
            </button>
            {canDeleteBoardItem(flow.createdById, config.currentUser) ? (
              <button
                type="button"
                className="wpn-users-action wpn-users-action--labeled wpn-users-action--danger"
                aria-label={`Delete ${flow.name}`}
                onClick={() => setPendingDelete(flow)}
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
    <div className="wpn-settings-tab wpn-flow-list-tab">
      <ListSearchBar
        value={searchInput}
        onValueChange={setSearchInput}
        onSubmit={() => {
          setSearchQuery(searchInput);
          setPage(1);
        }}
        onClear={clearSearch}
        placeholder="Search flow name, author or page"
        trailing={<RefreshButton label="Refresh flows" loading={loading} onRefresh={refresh} />}
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
          className={["wpn-users-table", loading && flows ? "wpn-users-table--refetching" : ""]
            .filter(Boolean)
            .join(" ")}
        >
          <colgroup>
            <col className="wpn-flow-list-tab__col-name" />
            <col className="wpn-flow-list-tab__col-nodes" />
            <col />
            <col />
            <col className="wpn-flow-list-tab__col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col" className="wpn-flow-list-tab__nodes">
                Nodes
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
        itemLabel="flows"
        onPageChange={setPage}
        onPageSizeChange={(next) => {
          setPageSize(next);
          setPage(1);
        }}
      />

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete flow"
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

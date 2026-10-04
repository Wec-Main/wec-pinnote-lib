import { useCallback, useEffect, useState } from "react";
import { useAnnotationAuth, useAnnotationContext } from "../../../context/AnnotationContext";
import { ExportMenuButton } from "../../../components/primitives/ExportMenuButton";
import { Icon } from "../../../components/primitives/Icon";
import { ListSearchBar } from "../../../components/primitives/ListSearchBar";
import { RefreshButton } from "../../../components/primitives/RefreshButton";
import { SearchableSelect } from "../../../components/primitives/SearchableSelect";
import { TablePagination } from "../../../components/primitives/TablePagination";
import { TableSkeleton } from "../../../components/primitives/TableSkeleton";
import { Tooltip } from "../../../components/primitives/Tooltip";
import type { MenuItemDefinition } from "../../../components/primitives/Menu";
import { AuthorBadge } from "../../epicFlow/components/AuthorBadge";
import { ConfirmDialog } from "../../userManagement/components/ConfirmDialog";
import { useSharedFetch } from "../../../hooks/useSharedFetch";
import { useTokenGetter } from "../../../hooks/useTokenGetter";
import { useFlowStream } from "../../../hooks/useFlowStream";
import type { StreamEvent } from "../../../types/stream.types";
import { deleteFlow, fetchFlowDocument, listFlows } from "../../../services/flowchartService";
import { canDeleteBoardItem } from "../../../utils/epicFlow/boardPermissions";
import { canExportData } from "../../../utils/auth/permissions";
import { downloadDataUrl } from "../../../utils/downloadDataUrl";
import { downloadJson } from "../../../utils/downloadJson";
import { downloadTextFile } from "../../../utils/downloadTextFile";
import { stripExportNoise } from "../../../utils/exportBundle";
import {
  generateFlowDiagramPngDataUrl,
  generateFlowDiagramSvg,
} from "../../../utils/flowchart/export/exportDiagram";
import { NodeTypeRegistry } from "../../../utils/flowchart/nodeTypes";
import { formatRelativeTime } from "../../../utils/format";
import type { FlowJSON } from "../../../types/flowchart.types";
import type { Flow, FlowDocumentRecord } from "../../../types/flowPin.types";

const DEFAULT_PAGE_SIZE = 10;
const COLUMN_COUNT = 5;
const PINNED_FILTER_OPTIONS = [
  { value: "true", label: "Pinned" },
  { value: "false", label: "Not pinned" },
];
const nodeTypeRegistry = new NodeTypeRegistry();
const getFlowNodeDefinition = (type: string) => nodeTypeRegistry.get(type);

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

export function FlowListPanel({ onOpen }: FlowListPanelProps) {
  const { config, flowsVersionId } = useAnnotationContext();
  const { hostAuthenticated, activeAccount } = useAnnotationAuth();
  const getToken = useTokenGetter(config.getAuthToken);
  const mayExport = Boolean(activeAccount?.roleId && canExportData(activeAccount.roleId));
  const sessionKey = hostAuthenticated ? "host" : (activeAccount?.id ?? "");

  const [pendingDelete, setPendingDelete] = useState<Flow | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [pinnedFilter, setPinnedFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const flowsKey = sessionKey
    ? `flows-list:${config.apiBaseUrl}:${sessionKey}:${config.projectId}:${flowsVersionId ?? ""}:${searchQuery}:${pinnedFilter}:${page}:${pageSize}`
    : null;

  const {
    data: flowPage,
    loading,
    error,
    reload,
  } = useSharedFetch(flowsKey, (signal) =>
    getToken().then((authToken) =>
      listFlows(
        config.apiBaseUrl,
        authToken,
        {
          projectId: config.projectId,
          projectVersionId: flowsVersionId,
          search: searchQuery || undefined,
          pinned: pinnedFilter === "" ? undefined : pinnedFilter === "true",
          limit: pageSize,
          offset: (page - 1) * pageSize,
        },
        signal,
      ),
    ),
  );

  const flows = flowPage?.flows ?? null;
  const total = flowPage?.total ?? 0;

  const refresh = reload;

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

  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const visible = flows ?? [];

  useEffect(() => {
    if (flowPage && page > lastPage) {
      setPage(lastPage);
    }
  }, [flowPage, page, lastPage]);

  const safeFileName = (flow: Flow) =>
    flow.name.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || flow.id;

  const withFlowRecord = async (
    flow: Flow,
    run: (record: FlowDocumentRecord) => void | Promise<void>,
  ) => {
    setNotice(null);
    try {
      const authToken = await getToken();
      const record = await fetchFlowDocument(config.apiBaseUrl, authToken, flow.id);
      await run(record);
    } catch (err) {
      setNotice(describeApiError(err));
    }
  };

  const withFlowDocument = (flow: Flow, run: (document: FlowJSON) => void | Promise<void>) =>
    withFlowRecord(flow, (record) => run(record.document));

  const exportItemsFor = (flow: Flow): MenuItemDefinition[] => [
    {
      type: "action",
      id: "json",
      label: "Export as JSON",
      icon: "download",
      onSelect: () =>
        void withFlowRecord(flow, (record) => {
          downloadJson(`flow_${safeFileName(flow)}.json`, stripExportNoise(record));
        }),
    },
    {
      type: "action",
      id: "svg",
      label: "Export as SVG",
      icon: "download",
      onSelect: () =>
        void withFlowDocument(flow, (document) => {
          downloadTextFile(
            `${safeFileName(flow)}.svg`,
            generateFlowDiagramSvg(document, getFlowNodeDefinition),
            "image/svg+xml",
          );
        }),
    },
    {
      type: "action",
      id: "png",
      label: "Export as PNG",
      icon: "download",
      onSelect: () =>
        void withFlowDocument(flow, async (document) => {
          const svg = generateFlowDiagramSvg(document, getFlowNodeDefinition);
          const dataUrl = await generateFlowDiagramPngDataUrl(svg);
          await downloadDataUrl(`${safeFileName(flow)}.png`, dataUrl);
        }),
    },
  ];

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
              {searchQuery || pinnedFilter
                ? "No flows match your search or filters."
                : "No flows in this version yet."}
            </span>
            {searchQuery || pinnedFilter ? (
              <button
                type="button"
                className="wpn-btn wpn-btn--ghost"
                onClick={() => {
                  clearSearch();
                  setPinnedFilter("");
                }}
              >
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
              className="wpn-users-action wpn-users-action--primary wpn-users-action--labeled"
              aria-label={`Open ${flow.name}`}
              onClick={() => onOpen(flow.id)}
            >
              <Icon name="open" />
              <span>Open</span>
            </button>
            {mayExport ? (
              <ExportMenuButton
                ariaLabel={`Export ${flow.name}`}
                triggerClassName="wpn-users-action wpn-users-action--labeled"
                items={exportItemsFor(flow)}
              />
            ) : null}
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
        trailing={
          <>
            <SearchableSelect
              options={PINNED_FILTER_OPTIONS}
              value={pinnedFilter}
              onChange={(next) => {
                setPinnedFilter(next);
                setPage(1);
              }}
              placeholder="All flows"
              ariaLabel="Filter by pinned status"
              searchable={false}
              clearable
            />
            <RefreshButton label="Refresh flows" loading={loading} onRefresh={refresh} />
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

      <div className="wpn-table-card">
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
          page={page}
          pageSize={pageSize}
          totalItems={total}
          itemLabel="flows"
          onPageChange={setPage}
          onPageSizeChange={(next) => {
            setPageSize(next);
            setPage(1);
          }}
        />
      </div>

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

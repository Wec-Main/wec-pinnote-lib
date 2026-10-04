import { Fragment, memo, useCallback, useState } from "react";
import { useAnnotationContext } from "../../../context/AnnotationContext";
import { useTokenGetter } from "../../../hooks/useTokenGetter";
import { downloadAnalyticsVisitsCsv, fetchAnalyticsVisits } from "../../../services/analyticsApi";
import type { AnalyticsFilters, VisitRecord } from "../../../types/analytics.types";
import { formatRelativeTime, formatTimestamp } from "../../../utils/format";
import {
  DataTable,
  Icon,
  SearchableSelect,
  TablePagination,
  Tooltip,
  type SelectOption,
} from "../../primitives";
import { formatDuration } from "./dashboardFormat";
import { widgetView } from "./dashboardStatus";
import { WidgetMessage } from "./DashboardWidgetMessage";
import { useDashboardFetch, useKnownTotal } from "./useDashboardFetch";

interface VisitLogTableProps {
  filters: AnalyticsFilters;
  reloadToken: number;
  userOptions: SelectOption[];
  pageOptions: SelectOption[];
  projectName: (projectId: string) => string;
}

interface VisitLogRowProps {
  visit: VisitRecord;
  isOpen: boolean;
  onToggle: (visitId: string) => void;
  projectName: (projectId: string) => string;
}

function exportFileName(filters: AnalyticsFilters): string {
  return ["visits", filters.from, filters.to].filter(Boolean).join("-") + ".csv";
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const VisitLogRow = memo(function VisitLogRow({
  visit,
  isOpen,
  onToggle,
  projectName,
}: VisitLogRowProps) {
  const handleToggle = useCallback(() => onToggle(visit.visitId), [onToggle, visit.visitId]);

  return (
    <Fragment>
      <tr className="wpn-dashboard-reveal">
        <td className="wpn-users-table__muted">
          <Tooltip label={formatTimestamp(visit.enteredAt)} placement="top">
            <span>{formatRelativeTime(visit.enteredAt)}</span>
          </Tooltip>
        </td>
        <td>
          <span className="wpn-users-identity__name" title={visit.userId}>
            {visit.userName}
          </span>
        </td>
        <td className="wpn-dashboard-pages__page" title={visit.pageKey}>
          <span className="wpn-users-org">{visit.pageKey}</span>
          <span className="wpn-users-org__country">{projectName(visit.projectId)}</span>
        </td>
        <td className="wpn-dashboard-pages__numeric">{formatDuration(visit.durationMs)}</td>
        <td className="wpn-dashboard-pages__numeric">{`${visit.maxScrollDepth}%`}</td>
        <td>
          <div className="wpn-users-actions">
            <button
              type="button"
              className="wpn-users-action"
              aria-label={isOpen ? "Hide details" : "Show details"}
              aria-expanded={isOpen}
              onClick={handleToggle}
            >
              <Icon name={isOpen ? "collapse" : "expand"} />
            </button>
          </div>
        </td>
      </tr>
      {isOpen ? (
        <tr className="wpn-audit-details-row">
          <td colSpan={6}>
            <div className="wpn-audit-details">
              <dl className="wpn-audit-meta">
                <div className="wpn-audit-meta__item">
                  <dt>Entered</dt>
                  <dd>{formatTimestamp(visit.enteredAt)}</dd>
                </div>
                <div className="wpn-audit-meta__item">
                  <dt>URL path</dt>
                  <dd>{visit.urlPath}</dd>
                </div>
                <div className="wpn-audit-meta__item">
                  <dt>IP address</dt>
                  <dd>{visit.ipAddress ?? "—"}</dd>
                </div>
                <div className="wpn-audit-meta__item wpn-audit-meta__item--wide">
                  <dt>User agent</dt>
                  <dd>{visit.userAgent ?? "—"}</dd>
                </div>
              </dl>
            </div>
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
});

export function VisitLogTable({
  filters,
  reloadToken,
  userOptions,
  pageOptions,
  projectName,
}: VisitLogTableProps) {
  const { config } = useAnnotationContext();
  const getToken = useTokenGetter(config.getAuthToken);
  const [userId, setUserId] = useState("");
  const [pageKey, setPageKey] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const query = {
    ...filters,
    userId: userId || undefined,
    pageKey: pageKey || undefined,
  };

  const { data, loading, loaded, error } = useDashboardFetch(
    [query, page, pageSize, reloadToken],
    (apiBaseUrl, authToken, signal) =>
      fetchAnalyticsVisits(
        apiBaseUrl,
        authToken,
        { ...query, limit: pageSize, offset: (page - 1) * pageSize },
        signal,
      ),
    "Unable to load the visit log.",
  );
  const visits = data?.visits ?? [];
  const total = useKnownTotal(data?.total);

  const toggleExpanded = useCallback((visitId: string) => {
    setExpanded((current) => (current === visitId ? null : visitId));
  }, []);

  const changeUser = (next: string) => {
    setUserId(next);
    setPage(1);
  };

  const changePage = (next: string) => {
    setPageKey(next);
    setPage(1);
  };

  const exportCsv = () => {
    setExporting(true);
    setExportError(null);
    getToken()
      .then((authToken) =>
        downloadAnalyticsVisitsCsv(config.apiBaseUrl, authToken || undefined, query),
      )
      .then((blob) => {
        saveBlob(blob, exportFileName(filters));
        setExporting(false);
      })
      .catch((err: unknown) => {
        setExportError(err instanceof Error ? err.message : "Unable to export the visit log.");
        setExporting(false);
      });
  };

  const view = widgetView({ loading, loaded, error, isEmpty: visits.length === 0 });

  return (
    <section className="wpn-dashboard-section wpn-dashboard-visits">
      <div className="wpn-dashboard-section__header">
        <h3 className="wpn-dashboard-section__title">Visit log</h3>
        <div className="wpn-dashboard-visits__filters">
          <SearchableSelect
            options={userOptions}
            value={userId}
            onChange={changeUser}
            placeholder="All users"
            searchPlaceholder="Search users"
            ariaLabel="Filter visits by user"
            clearable
          />
          <SearchableSelect
            options={pageOptions}
            value={pageKey}
            onChange={changePage}
            placeholder="All pages"
            searchPlaceholder="Search pages"
            ariaLabel="Filter visits by page"
            clearable
          />
          <button
            type="button"
            className="wpn-btn wpn-btn--ghost"
            aria-busy={exporting}
            disabled={exporting}
            onClick={exportCsv}
          >
            <Icon name="download" className="wpn-btn__icon" />
            {exporting ? "Exporting" : "Export CSV"}
          </button>
          {exportError ? <WidgetMessage tone="error" icon="alert" title={exportError} /> : null}
        </div>
      </div>

      <DataTable<VisitRecord>
        state={view}
        items={visits}
        getRowKey={(visit) => visit.visitId}
        cardWrap={false}
        tableClassName="wpn-dashboard-visits__table"
        refetching={loading && loaded}
        skeleton={{
          rows: Math.min(pageSize, 5),
          columns: ["text", "text", "text", "text", "text", "actions"],
          label: "Loading the visit log...",
        }}
        head={
          <>
            <th scope="col">When</th>
            <th scope="col">User</th>
            <th scope="col">Page</th>
            <th scope="col" className="wpn-dashboard-pages__numeric">
              Duration
            </th>
            <th scope="col" className="wpn-dashboard-pages__numeric">
              Scroll
            </th>
            <th scope="col" className="wpn-users-table__actions-head">
              Details
            </th>
          </>
        }
        errorRow={
          <tr>
            <td colSpan={6}>
              <WidgetMessage tone="error" icon="alert" title={error ?? ""} />
            </td>
          </tr>
        }
        emptyRow={
          <tr>
            <td colSpan={6}>
              <WidgetMessage tone="empty" icon="history" title="No visits match these filters" />
            </td>
          </tr>
        }
        renderRow={(visit) => (
          <VisitLogRow
            visit={visit}
            isOpen={expanded === visit.visitId}
            onToggle={toggleExpanded}
            projectName={projectName}
          />
        )}
        pagination={
          <TablePagination
            page={page}
            pageSize={pageSize}
            totalItems={total}
            itemLabel="visits"
            onPageChange={setPage}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setPage(1);
            }}
          />
        }
      />
    </section>
  );
}

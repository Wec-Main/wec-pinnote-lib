import { useState } from "react";
import { fetchAnalyticsPages } from "../../../services/analyticsApi";
import type { AnalyticsFilters } from "../../../types/analytics.types";
import { TablePagination, TableSkeleton } from "../../primitives";
import { dashboardNumberFormat, formatDuration } from "./dashboardFormat";
import { widgetView } from "./dashboardStatus";
import { WidgetMessageRow } from "./DashboardWidgetMessage";
import { useDashboardFetch, useKnownTotal } from "./useDashboardFetch";

const PAGE_VISITS_COLUMNS = 4;

interface PageVisitsTableProps {
  filters: AnalyticsFilters;
  reloadToken: number;
  projectName: (projectId: string) => string;
}

export function PageVisitsTable({ filters, reloadToken, projectName }: PageVisitsTableProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data, loading, loaded, error } = useDashboardFetch(
    [filters, page, pageSize, reloadToken],
    (apiBaseUrl, authToken, signal) =>
      fetchAnalyticsPages(apiBaseUrl, authToken, filters, pageSize, (page - 1) * pageSize, signal),
    "Unable to load page visits.",
  );
  const rows = data?.pages ?? [];
  const total = useKnownTotal(data?.total);
  const view = widgetView({ loading, loaded, error, isEmpty: rows.length === 0 });

  return (
    <div className="wpn-dashboard-pages">
      <div className="wpn-users-table-wrap">
        <table
          className={[
            "wpn-users-table",
            "wpn-dashboard-pages__table",
            loading && loaded ? "wpn-users-table--refetching" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <thead>
            <tr>
              <th scope="col">Project</th>
              <th scope="col">Page</th>
              <th scope="col" className="wpn-dashboard-pages__numeric">
                Visits
              </th>
              <th scope="col" className="wpn-dashboard-pages__numeric">
                Average duration
              </th>
            </tr>
          </thead>
          <tbody>
            {view === "loading" ? (
              <TableSkeleton
                rows={Math.min(pageSize, 5)}
                columns={["text", "text", "text", "text"]}
                label="Loading page visits..."
              />
            ) : view === "error" ? (
              <WidgetMessageRow
                colSpan={PAGE_VISITS_COLUMNS}
                tone="error"
                icon="alert"
                title={error ?? ""}
              />
            ) : view === "empty" ? (
              <WidgetMessageRow
                colSpan={PAGE_VISITS_COLUMNS}
                tone="empty"
                icon="layers"
                title="No page visits yet"
                detail="Visits appear once signed-in users browse pages in this range."
              />
            ) : (
              rows.map((row) => (
                <tr key={`${row.projectId}:${row.pageKey}`} className="wpn-dashboard-reveal">
                  <td>
                    <span className="wpn-users-org">{projectName(row.projectId)}</span>
                  </td>
                  <td className="wpn-dashboard-pages__page" title={row.pageKey}>
                    {row.pageKey}
                  </td>
                  <td className="wpn-dashboard-pages__numeric">
                    {dashboardNumberFormat.format(row.visits)}
                  </td>
                  <td className="wpn-dashboard-pages__numeric wpn-users-table__muted">
                    {formatDuration(row.avgDurationMs)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={page}
        pageSize={pageSize}
        totalItems={total}
        itemLabel="pages"
        onPageChange={setPage}
        onPageSizeChange={(next) => {
          setPageSize(next);
          setPage(1);
        }}
      />
    </div>
  );
}

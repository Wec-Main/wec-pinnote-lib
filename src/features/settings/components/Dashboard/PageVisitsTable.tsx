import { useState } from "react";
import { fetchAnalyticsPages } from "../../../../services/analyticsService";
import type { AnalyticsFilters, PageVisitRow } from "../../../../types/analytics.types";
import { DataTable } from "../../../../components/primitives/DataTable";
import { TablePagination } from "../../../../components/primitives/TablePagination";
import { dashboardNumberFormat, formatDuration } from "./dashboardFormat";
import { widgetView } from "./dashboardStatus";
import { WidgetMessage } from "./DashboardWidgetMessage";
import { useDashboardFetch, useKnownTotal } from "./useDashboardFetch";

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
      <DataTable<PageVisitRow>
        state={view}
        items={rows}
        getRowKey={(row) => `${row.projectId}:${row.pageKey}`}
        cardWrap={false}
        tableClassName="wpn-dashboard-pages__table"
        refetching={loading && loaded}
        skeleton={{
          rows: Math.min(pageSize, 5),
          columns: ["text", "text", "text", "text"],
          label: "Loading page visits...",
        }}
        head={
          <>
            <th scope="col">Project</th>
            <th scope="col">Page</th>
            <th scope="col" className="wpn-dashboard-pages__numeric">
              Visits
            </th>
            <th scope="col" className="wpn-dashboard-pages__numeric">
              Average duration
            </th>
          </>
        }
        errorRow={
          <tr>
            <td colSpan={4}>
              <WidgetMessage tone="error" icon="alert" title={error ?? ""} />
            </td>
          </tr>
        }
        emptyRow={
          <tr>
            <td colSpan={4}>
              <WidgetMessage
                tone="empty"
                icon="layers"
                title="No page visits yet"
                detail="Visits appear once signed-in users browse pages in this range."
              />
            </td>
          </tr>
        }
        renderRow={(row) => (
          <tr className="wpn-dashboard-reveal">
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
        )}
        pagination={
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
        }
      />
    </div>
  );
}

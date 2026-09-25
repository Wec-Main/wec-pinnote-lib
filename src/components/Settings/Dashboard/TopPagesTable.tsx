import { useEffect } from "react";
import { fetchAnalyticsPages } from "../../../services/analyticsApi";
import type { AnalyticsFilters, PageVisitRow } from "../../../types/analytics.types";
import { TableSkeleton } from "../../primitives";
import { dashboardNumberFormat, formatDuration } from "./dashboardFormat";
import { DASHBOARD_TOP_LIMIT } from "./dashboardLimits";
import { widgetView } from "./dashboardStatus";
import { WidgetMessageRow } from "./DashboardWidgetMessage";
import { useDashboardFetch } from "./useDashboardFetch";

const TOP_PAGES_COLUMNS = 4;

interface TopPagesTableProps {
  filters: AnalyticsFilters;
  reloadToken: number;
  projectName: (projectId: string) => string;
  onPagesLoaded: (pages: PageVisitRow[]) => void;
}

export function TopPagesTable({
  filters,
  reloadToken,
  projectName,
  onPagesLoaded,
}: TopPagesTableProps) {
  const { data, loading, loaded, error } = useDashboardFetch(
    [filters, reloadToken],
    (apiBaseUrl, authToken, signal) =>
      fetchAnalyticsPages(apiBaseUrl, authToken, filters, DASHBOARD_TOP_LIMIT, 0, signal),
    "Unable to load top pages.",
  );

  useEffect(() => {
    if (data) {
      onPagesLoaded(data.pages);
    }
  }, [data, onPagesLoaded]);

  const rows = data?.pages ?? [];
  const view = widgetView({ loading, loaded, error, isEmpty: rows.length === 0 });

  return (
    <section className="wpn-dashboard-section wpn-dashboard-top__panel">
      <h3 className="wpn-dashboard-section__title">Top pages</h3>

      <div className="wpn-users-table-wrap">
        <table
          className={[
            "wpn-users-table",
            "wpn-dashboard-ranked",
            loading && loaded ? "wpn-users-table--refetching" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <thead>
            <tr>
              <th scope="col" className="wpn-dashboard-ranked__rank">
                #
              </th>
              <th scope="col">Page</th>
              <th scope="col" className="wpn-dashboard-pages__numeric">
                Visits
              </th>
              <th scope="col" className="wpn-dashboard-pages__numeric">
                Avg. time
              </th>
            </tr>
          </thead>
          <tbody>
            {view === "loading" ? (
              <TableSkeleton
                rows={5}
                columns={["text", "text", "text", "text"]}
                label="Loading top pages..."
              />
            ) : view === "error" ? (
              <WidgetMessageRow
                colSpan={TOP_PAGES_COLUMNS}
                tone="error"
                icon="alert"
                title={error ?? ""}
              />
            ) : view === "empty" ? (
              <WidgetMessageRow
                colSpan={TOP_PAGES_COLUMNS}
                tone="empty"
                icon="layers"
                title="No pages ranked yet"
              />
            ) : (
              rows.map((row, index) => (
                <tr key={`${row.projectId}:${row.pageKey}`} className="wpn-dashboard-reveal">
                  <td className="wpn-dashboard-ranked__rank wpn-users-table__muted">{index + 1}</td>
                  <td className="wpn-dashboard-pages__page" title={row.pageKey}>
                    <span className="wpn-users-org">{row.pageKey}</span>
                    <span className="wpn-users-org__country">{projectName(row.projectId)}</span>
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
    </section>
  );
}

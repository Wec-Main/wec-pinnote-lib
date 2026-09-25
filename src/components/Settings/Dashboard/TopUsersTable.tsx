import { useEffect } from "react";
import { fetchAnalyticsUsers } from "../../../services/analyticsApi";
import type { AnalyticsFilters, TopUserRecord } from "../../../types/analytics.types";
import { getInitials } from "../../../utils/format";
import { TableSkeleton } from "../../primitives";
import { dashboardNumberFormat } from "./dashboardFormat";
import { DASHBOARD_TOP_LIMIT } from "./dashboardLimits";
import { widgetView } from "./dashboardStatus";
import { WidgetMessageRow } from "./DashboardWidgetMessage";
import { useDashboardFetch } from "./useDashboardFetch";

const TOP_USERS_COLUMNS = 5;

interface TopUsersTableProps {
  filters: AnalyticsFilters;
  reloadToken: number;
  onUsersLoaded: (users: TopUserRecord[]) => void;
}

export function TopUsersTable({ filters, reloadToken, onUsersLoaded }: TopUsersTableProps) {
  const { data, loading, loaded, error } = useDashboardFetch(
    [filters, reloadToken],
    (apiBaseUrl, authToken, signal) =>
      fetchAnalyticsUsers(apiBaseUrl, authToken, filters, DASHBOARD_TOP_LIMIT, 0, signal),
    "Unable to load top users.",
  );

  useEffect(() => {
    if (data) {
      onUsersLoaded(data.users);
    }
  }, [data, onUsersLoaded]);

  const rows = data?.users ?? [];
  const view = widgetView({ loading, loaded, error, isEmpty: rows.length === 0 });

  return (
    <section className="wpn-dashboard-section wpn-dashboard-top__panel">
      <h3 className="wpn-dashboard-section__title">Top users</h3>

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
              <th scope="col">User</th>
              <th scope="col" className="wpn-dashboard-pages__numeric">
                Visits
              </th>
              <th scope="col" className="wpn-dashboard-pages__numeric">
                Active days
              </th>
              <th scope="col">Last visit</th>
            </tr>
          </thead>
          <tbody>
            {view === "loading" ? (
              <TableSkeleton
                rows={5}
                columns={["text", "identity", "text", "text", "text"]}
                label="Loading top users..."
              />
            ) : view === "error" ? (
              <WidgetMessageRow
                colSpan={TOP_USERS_COLUMNS}
                tone="error"
                icon="alert"
                title={error ?? ""}
              />
            ) : view === "empty" ? (
              <WidgetMessageRow
                colSpan={TOP_USERS_COLUMNS}
                tone="empty"
                icon="users"
                title="No user activity yet"
              />
            ) : (
              rows.map((row, index) => (
                <tr key={row.userId} className="wpn-dashboard-reveal">
                  <td className="wpn-dashboard-ranked__rank wpn-users-table__muted">{index + 1}</td>
                  <td>
                    <div className="wpn-users-identity">
                      <span className="wpn-avatar wpn-avatar--fallback">
                        {getInitials(row.userName)}
                      </span>
                      <span className="wpn-users-identity__name" title={row.userId}>
                        {row.userName}
                      </span>
                    </div>
                  </td>
                  <td className="wpn-dashboard-pages__numeric">
                    {dashboardNumberFormat.format(row.visits)}
                  </td>
                  <td className="wpn-dashboard-pages__numeric">
                    {dashboardNumberFormat.format(row.activeDays)}
                  </td>
                  <td className="wpn-users-table__muted">{row.lastVisitDay}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

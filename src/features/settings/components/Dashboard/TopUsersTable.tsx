import type { TopUserRecord } from "../../../../types/analytics.types";
import { getInitials } from "../../../../utils/format";
import { DataTable } from "../../../../components/primitives/DataTable";
import { dashboardNumberFormat } from "./dashboardFormat";
import { widgetView } from "./dashboardStatus";
import { WidgetMessage } from "./DashboardWidgetMessage";

interface TopUsersTableProps {
  rows: TopUserRecord[] | null;
  refreshing: boolean;
}

export function TopUsersTable({ rows, refreshing }: TopUsersTableProps) {
  const view = widgetView({
    loading: rows === null,
    loaded: rows !== null,
    error: null,
    isEmpty: rows?.length === 0,
  });
  const items = rows ?? [];

  return (
    <section className="wpn-dashboard-section wpn-dashboard-top__panel">
      <h3 className="wpn-dashboard-section__title">Top users</h3>

      <DataTable<TopUserRecord>
        state={view}
        items={items}
        getRowKey={(row) => row.userId}
        cardWrap={false}
        tableClassName="wpn-dashboard-ranked"
        refetching={refreshing}
        skeleton={{
          rows: 5,
          columns: ["text", "identity", "text", "text", "text"],
          label: "Loading top users...",
        }}
        head={
          <>
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
          </>
        }
        errorRow={null}
        emptyRow={
          <tr>
            <td colSpan={5}>
              <WidgetMessage tone="empty" icon="users" title="No user activity yet" />
            </td>
          </tr>
        }
        renderRow={(row, index) => (
          <tr className="wpn-dashboard-reveal">
            <td className="wpn-dashboard-ranked__rank wpn-users-table__muted">{index + 1}</td>
            <td>
              <div className="wpn-users-identity">
                <span className="wpn-avatar wpn-avatar--fallback">{getInitials(row.userName)}</span>
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
        )}
      />
    </section>
  );
}

import type { PageVisitRow } from "../../../types/analytics.types";
import { DataTable } from "../../primitives";
import { dashboardNumberFormat, formatDuration } from "./dashboardFormat";
import { widgetView } from "./dashboardStatus";
import { WidgetMessage } from "./DashboardWidgetMessage";

interface TopPagesTableProps {
  rows: PageVisitRow[] | null;
  refreshing: boolean;
  projectName: (projectId: string) => string;
}

export function TopPagesTable({ rows, refreshing, projectName }: TopPagesTableProps) {
  const view = widgetView({
    loading: rows === null,
    loaded: rows !== null,
    error: null,
    isEmpty: rows?.length === 0,
  });
  const items = rows ?? [];

  return (
    <section className="wpn-dashboard-section wpn-dashboard-top__panel">
      <h3 className="wpn-dashboard-section__title">Top pages</h3>

      <DataTable<PageVisitRow>
        state={view}
        items={items}
        getRowKey={(row) => `${row.projectId}:${row.pageKey}`}
        cardWrap={false}
        tableClassName="wpn-dashboard-ranked"
        refetching={refreshing}
        skeleton={{ rows: 5, columns: ["text", "text", "text", "text"], label: "Loading top pages..." }}
        head={
          <>
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
          </>
        }
        errorRow={null}
        emptyRow={
          <tr>
            <td colSpan={4}>
              <WidgetMessage tone="empty" icon="layers" title="No pages ranked yet" />
            </td>
          </tr>
        }
        renderRow={(row, index) => (
          <tr className="wpn-dashboard-reveal">
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
        )}
      />
    </section>
  );
}

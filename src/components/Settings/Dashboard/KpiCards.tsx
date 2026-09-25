import { Icon, type IconName } from "../../primitives";
import type { AnalyticsSummary } from "../../../types/analytics.types";
import { ANNOTATION_STATUS_OPTIONS } from "../../../utils/status";

export type KpiCardsState =
  { kind: "loading" } | { kind: "ready"; summary: AnalyticsSummary; refreshing: boolean };

interface KpiCardsProps {
  state: KpiCardsState;
}

interface KpiCardDefinition {
  label: string;
  value: (summary: AnalyticsSummary) => number;
  icon: IconName;
}

const KPI_CARDS: KpiCardDefinition[] = [
  { label: "Total users", value: (summary) => summary.users.total, icon: "users" },
  { label: "Logins", value: (summary) => summary.logins.total, icon: "key" },
  { label: "Unique logins", value: (summary) => summary.logins.unique, icon: "pen" },
  { label: "Failed logins", value: (summary) => summary.logins.failed, icon: "alert" },
  { label: "Comments", value: (summary) => summary.comments.total, icon: "comment" },
  { label: "Annotations", value: (summary) => summary.annotations.total, icon: "edit" },
];

const numberFormat = new Intl.NumberFormat();

export function KpiCards({ state }: KpiCardsProps) {
  const summary = state.kind === "ready" ? state.summary : null;
  const busy = state.kind === "loading" || state.refreshing;
  return (
    <div className="wpn-dashboard-kpis" aria-busy={busy}>
      <ul className="wpn-dashboard-kpis__grid">
        {KPI_CARDS.map((card) => (
          <li key={card.label} className="wpn-dashboard-kpi">
            <div className="wpn-dashboard-kpi__header">
              <span className="wpn-dashboard-kpi__label">{card.label}</span>
              <Icon name={card.icon} className="wpn-dashboard-kpi__icon" />
            </div>
            {summary ? (
              <span className="wpn-dashboard-kpi__value">
                {numberFormat.format(card.value(summary))}
              </span>
            ) : (
              <span className="wpn-skeleton wpn-skeleton--line wpn-dashboard-kpi__skeleton" />
            )}
          </li>
        ))}
      </ul>

      <div className="wpn-dashboard-status">
        <span className="wpn-dashboard-kpi__label">Annotations by status</span>
        <ul className="wpn-dashboard-status__list">
          {ANNOTATION_STATUS_OPTIONS.map((status) => (
            <li key={status.value} className="wpn-dashboard-status__item">
              <span className="wpn-users-pill wpn-audit-pill--neutral">{status.label}</span>
              {summary ? (
                <span className="wpn-dashboard-status__count">
                  {numberFormat.format(summary.annotations.byStatus[status.value] ?? 0)}
                </span>
              ) : (
                <span className="wpn-skeleton wpn-skeleton--line wpn-dashboard-status__skeleton" />
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

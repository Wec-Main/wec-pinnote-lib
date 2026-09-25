import { useMemo } from "react";
import { fetchAnalyticsTrends } from "../../../services/analyticsApi";
import type { AnalyticsFilters, TrendDay } from "../../../types/analytics.types";
import { trendChartGeometry } from "../../../utils/trendChart";
import { dashboardNumberFormat } from "./dashboardFormat";
import { hasTrendActivity, widgetView } from "./dashboardStatus";
import { WidgetMessage } from "./DashboardWidgetMessage";
import { useDashboardFetch } from "./useDashboardFetch";

interface TrendsChartProps {
  filters: AnalyticsFilters;
  reloadToken: number;
}

type TrendSeriesKey = "visits" | "logins" | "comments";

interface TrendSeries {
  key: TrendSeriesKey;
  label: string;
  toneClass: string;
}

interface TrendPoint {
  date: string;
  visits: number;
  logins: number;
  comments: number;
}

const TREND_SERIES: TrendSeries[] = [
  { key: "visits", label: "Visits", toneClass: "wpn-dashboard-trends__series--visits" },
  { key: "logins", label: "Logins", toneClass: "wpn-tone--completed" },
  { key: "comments", label: "Comments", toneClass: "wpn-tone--dev-inprogress" },
];

const SERIES_KEYS = TREND_SERIES.map((series) => series.key);
const CHART_DIMENSIONS = { width: 720, height: 240, padding: 36 };
const Y_LABEL_OFFSET = 8;
const X_LABEL_OFFSET = 18;
const SINGLE_POINT_RADIUS = 3;

function toTrendPoint(day: TrendDay): TrendPoint {
  return { date: day.day, visits: day.visits, logins: day.logins, comments: day.comments };
}

function shortDay(date: string): string {
  return date.slice(5);
}

function seriesTotals(days: TrendDay[]): Record<TrendSeriesKey, number> {
  return days.reduce(
    (totals, day) => ({
      visits: totals.visits + day.visits,
      logins: totals.logins + day.logins,
      comments: totals.comments + day.comments,
    }),
    { visits: 0, logins: 0, comments: 0 },
  );
}

function chartSummary(days: TrendDay[], totals: Record<TrendSeriesKey, number>): string {
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) {
    return "Daily trends: no data for this range.";
  }
  const counts = TREND_SERIES.map(
    (series) => `${dashboardNumberFormat.format(totals[series.key])} ${series.label.toLowerCase()}`,
  ).join(", ");
  return `Daily trends from ${first.day} to ${last.day}: ${counts}.`;
}

export function TrendsChart({ filters, reloadToken }: TrendsChartProps) {
  const { data, loading, loaded, error } = useDashboardFetch(
    [filters, reloadToken],
    (apiBaseUrl, authToken, signal) => fetchAnalyticsTrends(apiBaseUrl, authToken, filters, signal),
    "Unable to load analytics trends.",
  );

  const days = useMemo(() => data?.days ?? [], [data]);
  const geometry = useMemo(
    () => trendChartGeometry(days.map(toTrendPoint), SERIES_KEYS, CHART_DIMENSIONS),
    [days],
  );
  const totals = useMemo(() => seriesTotals(days), [days]);
  const plotHeight = geometry.plotBottom - geometry.plotTop;
  const view = widgetView({ loading, loaded, error, isEmpty: !hasTrendActivity(days) });

  return (
    <section className="wpn-dashboard-section wpn-dashboard-trends">
      <h3 className="wpn-dashboard-section__title">Daily trends</h3>

      {view === "loading" ? (
        <span className="wpn-skeleton wpn-dashboard-trends__skeleton" />
      ) : view === "error" ? (
        <WidgetMessage tone="error" icon="alert" title={error ?? ""} />
      ) : view === "empty" ? (
        <WidgetMessage tone="empty" icon="history" title="No activity in this range" />
      ) : (
        <svg
          className="wpn-dashboard-trends__svg wpn-dashboard-reveal"
          viewBox={`0 0 ${CHART_DIMENSIONS.width} ${CHART_DIMENSIONS.height}`}
          role="img"
          aria-label={chartSummary(days, totals)}
        >
          {geometry.yTicks.map((tick) => {
            const y = geometry.plotBottom - (tick / geometry.yMax) * plotHeight;
            return (
              <g key={tick}>
                <line
                  className="wpn-dashboard-trends__grid"
                  x1={geometry.plotLeft}
                  x2={geometry.plotRight}
                  y1={y}
                  y2={y}
                />
                <text
                  className="wpn-dashboard-trends__axis-label"
                  x={geometry.plotLeft - Y_LABEL_OFFSET}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {dashboardNumberFormat.format(tick)}
                </text>
              </g>
            );
          })}
          {geometry.xLabels.map((label) => (
            <text
              key={label.index}
              className="wpn-dashboard-trends__axis-label"
              x={label.x}
              y={geometry.plotBottom + X_LABEL_OFFSET}
              textAnchor="middle"
            >
              {shortDay(label.label)}
            </text>
          ))}
          {TREND_SERIES.map((series) => {
            const plotted = geometry.series[series.key];
            if (!plotted) {
              return null;
            }
            return (
              <g key={series.key} className={`wpn-dashboard-trends__series ${series.toneClass}`}>
                <polyline className="wpn-dashboard-trends__line" points={plotted.points} />
                {plotted.coordinates.length === 1
                  ? plotted.coordinates.map((point) => (
                      <circle
                        key={`${point.x}:${point.y}`}
                        className="wpn-dashboard-trends__dot"
                        cx={point.x}
                        cy={point.y}
                        r={SINGLE_POINT_RADIUS}
                      />
                    ))
                  : null}
              </g>
            );
          })}
        </svg>
      )}

      <ul className="wpn-dashboard-trends__legend">
        {TREND_SERIES.map((series) => (
          <li key={series.key} className={`wpn-dashboard-trends__legend-item ${series.toneClass}`}>
            <span className="wpn-dashboard-trends__swatch" aria-hidden="true" />
            <span>{series.label}</span>
            {view === "ready" ? (
              <span className="wpn-dashboard-trends__legend-total">
                {dashboardNumberFormat.format(totals[series.key])}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

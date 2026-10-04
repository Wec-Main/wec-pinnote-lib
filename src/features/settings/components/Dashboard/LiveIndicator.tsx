import { liveIndicator, type AnalyticsStreamState } from "./analyticsStreamState";

export function LiveIndicator({ state }: { state: AnalyticsStreamState }) {
  const { label, tone } = liveIndicator(state);
  return (
    <span className={`wpn-dashboard-live wpn-dashboard-live--${tone}`} role="status">
      <span className="wpn-dashboard-live__dot" aria-hidden="true" />
      {label}
    </span>
  );
}

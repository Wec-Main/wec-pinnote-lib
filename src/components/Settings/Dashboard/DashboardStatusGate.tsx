import type { ReactNode } from "react";
import type { DashboardError, DashboardStatus } from "./dashboardStatus";
import { KpiCards } from "./KpiCards";

interface DashboardStatusGateProps {
  status: DashboardStatus;
  error: DashboardError | null;
  onRetry: () => void;
  children: ReactNode;
}

const UNAVAILABLE_TITLE = "Analytics tables are not set up";
const UNAVAILABLE_DETAIL = "Apply the analytics table scripts in db/tables/ on the API, then retry.";
const ERROR_TITLE = "Unable to load analytics";
const ERROR_FALLBACK_DETAIL = "Something went wrong while loading the dashboard.";

function DashboardNotice({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail: string;
  onRetry: () => void;
}) {
  return (
    <div className="wpn-users-notice wpn-dashboard-notice" role="alert">
      <span className="wpn-dashboard-notice__title">{title}</span>
      <span className="wpn-dashboard-notice__detail">{detail}</span>
      <div className="wpn-dashboard-notice__actions">
        <button type="button" className="wpn-btn wpn-btn--primary" onClick={onRetry}>
          Retry
        </button>
      </div>
    </div>
  );
}

function DashboardLoadingPlaceholder() {
  return (
    <>
      <KpiCards state={{ kind: "loading" }} />
      <span
        className="wpn-skeleton wpn-dashboard-placeholder wpn-dashboard-placeholder--chart"
        aria-hidden="true"
      />
      <span
        className="wpn-skeleton wpn-dashboard-placeholder wpn-dashboard-placeholder--table"
        aria-hidden="true"
      />
      <span
        className="wpn-skeleton wpn-dashboard-placeholder wpn-dashboard-placeholder--table"
        aria-hidden="true"
      />
    </>
  );
}

export function DashboardStatusGate({
  status,
  error,
  onRetry,
  children,
}: DashboardStatusGateProps) {
  if (status === "unavailable") {
    return (
      <DashboardNotice title={UNAVAILABLE_TITLE} detail={UNAVAILABLE_DETAIL} onRetry={onRetry} />
    );
  }
  if (status === "error") {
    return (
      <DashboardNotice
        title={ERROR_TITLE}
        detail={error?.message || ERROR_FALLBACK_DETAIL}
        onRetry={onRetry}
      />
    );
  }
  if (status === "loading") {
    return <DashboardLoadingPlaceholder />;
  }
  return <>{children}</>;
}

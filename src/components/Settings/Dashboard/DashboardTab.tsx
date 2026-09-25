import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useAnnotationContext } from "../../../context/AnnotationContext";
import { useSharedFetch } from "../../../hooks/useSharedFetch";
import { fetchAnalyticsSummary } from "../../../services/analyticsApi";
import { fetchOrganizations, fetchProjects } from "../../../services/organizationsApi";
import { AnnotationApiError } from "../../../types/annotation.types";
import type {
  AnalyticsFilters,
  AnalyticsSummary,
  PageVisitRow,
  TopUserRecord,
} from "../../../types/analytics.types";
import type { Organization, Project } from "../../../types/organization.types";
import {
  rangeForPreset,
  validateCustomRange,
  type DateRange,
  type RangePreset,
} from "../../../utils/analyticsRange";
import { RefreshButton, SearchableSelect, type SelectOption } from "../../primitives";
import {
  ALL_DASHBOARD_SECTIONS,
  bumpSections,
  deriveDashboardStatus,
  initialSectionReloads,
  type DashboardError,
  type SectionReloads,
} from "./dashboardStatus";
import { sectionsForKinds, type AnalyticsChangeKind } from "./analyticsStreamState";
import { DashboardStatusGate } from "./DashboardStatusGate";
import { KpiCards } from "./KpiCards";
import { LiveIndicator } from "./LiveIndicator";
import { PageVisitsTable } from "./PageVisitsTable";
import { TopPagesTable } from "./TopPagesTable";
import { TopUsersTable } from "./TopUsersTable";
import { TrendsChart } from "./TrendsChart";
import { useAnalyticsStream } from "./useAnalyticsStream";
import { VisitLogTable } from "./VisitLogTable";

type RangeChoice = RangePreset | "custom";

const RANGE_OPTIONS: SelectOption[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "custom", label: "Custom range" },
];

const DEFAULT_PRESET: RangePreset = "7d";

export function DashboardTab() {
  const { config, activeAccount } = useAnnotationContext();
  const authToken = activeAccount?.token;
  const [organizationId, setOrganizationId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [rangeChoice, setRangeChoice] = useState<RangeChoice>(DEFAULT_PRESET);
  const [presetRange, setPresetRange] = useState<DateRange>(() =>
    rangeForPreset(DEFAULT_PRESET, new Date()),
  );
  const [customFrom, setCustomFrom] = useState(presetRange.from);
  const [customTo, setCustomTo] = useState(presetRange.to);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DashboardError | null>(null);
  const [reloads, setReloads] = useState<SectionReloads>(initialSectionReloads);
  const [topUsers, setTopUsers] = useState<TopUserRecord[]>([]);
  const [topPages, setTopPages] = useState<PageVisitRow[]>([]);

  const { data: organizationsData } = useSharedFetch<Organization[]>(
    `organizations:${config.apiBaseUrl}:${authToken ?? ""}`,
    (signal) => fetchOrganizations(config.apiBaseUrl, authToken, signal),
  );
  const { data: projectsData } = useSharedFetch<Project[]>(
    `projects:${config.apiBaseUrl}:${authToken ?? ""}:all`,
    (signal) => fetchProjects(config.apiBaseUrl, authToken, undefined, signal),
  );

  const organizationOptions = useMemo<SelectOption[]>(
    () =>
      (organizationsData ?? []).map((organization) => ({
        value: organization.id,
        label: organization.companyName,
      })),
    [organizationsData],
  );

  const projectOptions = useMemo<SelectOption[]>(
    () =>
      (projectsData ?? [])
        .filter((project) => !organizationId || project.organizationId === organizationId)
        .map((project) => ({ value: project.id, label: project.name })),
    [projectsData, organizationId],
  );

  const projectName = useCallback(
    (id: string) => projectsData?.find((project) => project.id === id)?.name ?? id,
    [projectsData],
  );

  const userOptions = useMemo<SelectOption[]>(
    () => topUsers.map((user) => ({ value: user.userId, label: user.userName })),
    [topUsers],
  );

  const pageOptions = useMemo<SelectOption[]>(
    () =>
      Array.from(new Set(topPages.map((row) => row.pageKey)), (pageKey) => ({
        value: pageKey,
        label: pageKey,
      })),
    [topPages],
  );

  const customValid = validateCustomRange(customFrom, customTo);
  const isCustom = rangeChoice === "custom";
  const rangeValid = !isCustom || customValid;
  const from = isCustom ? customFrom : presetRange.from;
  const to = isCustom ? customTo : presetRange.to;

  const filters = useMemo<AnalyticsFilters | null>(
    () =>
      rangeValid
        ? {
            organizationId: organizationId || undefined,
            projectId: projectId || undefined,
            from,
            to,
          }
        : null,
    [rangeValid, organizationId, projectId, from, to],
  );

  useEffect(() => {
    if (!filters) {
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchAnalyticsSummary(config.apiBaseUrl, authToken, filters, controller.signal)
      .then((result) => {
        setSummary(result);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setError({
          status: err instanceof AnnotationApiError ? err.status : null,
          message: err instanceof Error ? err.message : "Unable to load analytics.",
        });
        setLoading(false);
      });

    return () => controller.abort();
  }, [config.apiBaseUrl, authToken, filters, reloads.summary]);

  const refresh = useCallback(() => {
    if (rangeChoice !== "custom") {
      setPresetRange(rangeForPreset(rangeChoice, new Date()));
    }
    setReloads((current) => bumpSections(current, ALL_DASHBOARD_SECTIONS));
  }, [rangeChoice]);

  const changeRange = (next: string) => {
    const choice = (next || DEFAULT_PRESET) as RangeChoice;
    setRangeChoice(choice);
    if (choice !== "custom") {
      setPresetRange(rangeForPreset(choice, new Date()));
    }
  };

  const changeOrganization = (next: string) => {
    setOrganizationId(next);
    setProjectId("");
  };

  const filtersKey = [organizationId, projectId, from, to].join("|");
  const status = deriveDashboardStatus({ summaryLoaded: summary !== null, error });

  const reloadChangedSections = useCallback((kinds: AnalyticsChangeKind[]) => {
    setReloads((current) => bumpSections(current, sectionsForKinds(kinds)));
  }, []);

  const reloadAllSections = useCallback(() => {
    setReloads((current) => bumpSections(current, ALL_DASHBOARD_SECTIONS));
  }, []);

  const streamState = useAnalyticsStream({
    apiBaseUrl: config.apiBaseUrl,
    authToken,
    scope: {
      organizationId: organizationId || undefined,
      projectId: projectId || undefined,
    },
    enabled: status === "ready",
    onChange: reloadChangedSections,
    onResync: reloadAllSections,
  });

  return (
    <div className="wpn-settings-tab wpn-dashboard">
      <div className="wpn-dashboard__filters">
        <SearchableSelect
          options={organizationOptions}
          value={organizationId}
          onChange={changeOrganization}
          placeholder="All organizations"
          searchPlaceholder="Search organizations"
          ariaLabel="Filter by organization"
          clearable
        />
        <SearchableSelect
          options={projectOptions}
          value={projectId}
          onChange={setProjectId}
          placeholder="All projects"
          searchPlaceholder="Search projects"
          ariaLabel="Filter by project"
          clearable
        />
        <SearchableSelect
          options={RANGE_OPTIONS}
          value={rangeChoice}
          onChange={changeRange}
          placeholder="Date range"
          searchPlaceholder="Search range"
          ariaLabel="Filter by date range"
        />
        {rangeChoice === "custom" ? (
          <span className="wpn-dashboard__dates">
            <input
              type="date"
              className="wpn-dashboard__date"
              aria-label="From date"
              aria-invalid={customValid ? undefined : true}
              value={customFrom}
              max={customTo || undefined}
              onChange={(event) => setCustomFrom(event.target.value)}
            />
            <span className="wpn-dashboard__dates-separator">to</span>
            <input
              type="date"
              className="wpn-dashboard__date"
              aria-label="To date"
              aria-invalid={customValid ? undefined : true}
              value={customTo}
              min={customFrom || undefined}
              onChange={(event) => setCustomTo(event.target.value)}
            />
          </span>
        ) : null}
        <span className="wpn-dashboard__spacer" />
        {filters && status === "ready" ? <LiveIndicator state={streamState} /> : null}
        <RefreshButton
          label="Refresh dashboard"
          loading={Boolean(filters) && loading}
          onRefresh={refresh}
        />
      </div>

      {filters ? null : (
        <div className="wpn-users-notice" role="alert">
          <span>Choose a start date on or before the end date, spanning at most 366 days.</span>
        </div>
      )}

      {filters ? (
        <DashboardStatusGate status={status} error={error} onRetry={refresh}>
          {summary ? <KpiCards state={{ kind: "ready", summary, refreshing: loading }} /> : null}
          <PageVisitsTable
            key={`pages|${filtersKey}`}
            filters={filters}
            reloadToken={reloads.pages}
            projectName={projectName}
          />
          <Fragment key={`sections|${filtersKey}`}>
            <TrendsChart filters={filters} reloadToken={reloads.trends} />
            <div className="wpn-dashboard-top">
              <TopPagesTable
                filters={filters}
                reloadToken={reloads.topPages}
                projectName={projectName}
                onPagesLoaded={setTopPages}
              />
              <TopUsersTable
                filters={filters}
                reloadToken={reloads.topUsers}
                onUsersLoaded={setTopUsers}
              />
            </div>
            <VisitLogTable
              filters={filters}
              reloadToken={reloads.visitLog}
              userOptions={userOptions}
              pageOptions={pageOptions}
              projectName={projectName}
            />
          </Fragment>
        </DashboardStatusGate>
      ) : null}
    </div>
  );
}

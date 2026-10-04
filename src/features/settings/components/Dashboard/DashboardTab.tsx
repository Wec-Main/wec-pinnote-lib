import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAnnotationContext } from "../../../../context/AnnotationContext";
import { useSharedFetch } from "../../../../hooks/useSharedFetch";
import { useTokenGetter } from "../../../../hooks/useTokenGetter";
import { fetchAnalyticsOverview } from "../../../../services/analyticsService";
import { fetchProjects } from "../../../../services/settingsService";
import { AnnotationApiError } from "../../../../types/annotation.types";
import type { AnalyticsFilters, AnalyticsOverview } from "../../../../types/analytics.types";
import type { Project } from "../../../../types/organization.types";
import {
  rangeForPreset,
  validateCustomRange,
  type DateRange,
  type RangePreset,
} from "../../../../utils/analytics/analyticsRange";
import { RefreshButton } from "../../../../components/primitives/RefreshButton";
import {
  SearchableSelect,
  type SelectOption,
} from "../../../../components/primitives/SearchableSelect";
import {
  ALL_DASHBOARD_SECTIONS,
  bumpSections,
  deriveDashboardStatus,
  initialSectionReloads,
  type DashboardError,
  type SectionReloads,
} from "./dashboardStatus";
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
const CUSTOM_RANGE_DEBOUNCE_MS = 500;

interface LoadedOverview {
  key: string;
  data: AnalyticsOverview;
}

function filtersKeyOf(filters: AnalyticsFilters): string {
  return [filters.projectId, filters.from, filters.to].join("|");
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function DashboardTab() {
  const { config, activeAccount } = useAnnotationContext();
  const apiBaseUrl = config.apiBaseUrl;
  const getToken = useTokenGetter(config.getAuthToken);
  const identity = activeAccount?.id ?? "host";
  const [projectId, setProjectId] = useState(config.projectId);
  const [rangeChoice, setRangeChoice] = useState<RangeChoice>(DEFAULT_PRESET);
  const [presetRange, setPresetRange] = useState<DateRange>(() =>
    rangeForPreset(DEFAULT_PRESET, new Date()),
  );
  const [customFrom, setCustomFrom] = useState(presetRange.from);
  const [customTo, setCustomTo] = useState(presetRange.to);
  const [overview, setOverview] = useState<LoadedOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DashboardError | null>(null);
  const [reloads, setReloads] = useState<SectionReloads>(initialSectionReloads);
  const overviewKeyRef = useRef<string | null>(null);
  const liveReloadRef = useRef(false);

  const { data: projectsData } = useSharedFetch<Project[]>(
    `projects:${apiBaseUrl}:id:${identity}:all`,
    async (signal) => fetchProjects(apiBaseUrl, (await getToken()) || undefined, undefined, signal),
  );

  const projectOptions = useMemo<SelectOption[]>(
    () => (projectsData ?? []).map((project) => ({ value: project.id, label: project.name })),
    [projectsData],
  );

  const projectName = useCallback(
    (id: string) => projectsData?.find((project) => project.id === id)?.name ?? id,
    [projectsData],
  );

  const topUsers = overview?.data.topUsers;
  const topPages = overview?.data.topPages;

  const userOptions = useMemo<SelectOption[]>(
    () => (topUsers ?? []).map((user) => ({ value: user.userId, label: user.userName })),
    [topUsers],
  );

  const pageOptions = useMemo<SelectOption[]>(
    () =>
      Array.from(new Set((topPages ?? []).map((row) => row.pageKey)), (pageKey) => ({
        value: pageKey,
        label: pageKey,
      })),
    [topPages],
  );

  const debouncedCustom = useDebouncedValue(`${customFrom}|${customTo}`, CUSTOM_RANGE_DEBOUNCE_MS);
  const [settledFrom = "", settledTo = ""] = debouncedCustom.split("|");
  const customValid = validateCustomRange(customFrom, customTo);
  const isCustom = rangeChoice === "custom";
  const rangeValid = !isCustom || (customValid && validateCustomRange(settledFrom, settledTo));
  const from = isCustom ? settledFrom : presetRange.from;
  const to = isCustom ? settledTo : presetRange.to;

  const filters = useMemo<AnalyticsFilters | null>(
    () =>
      rangeValid
        ? {
            projectId,
            from,
            to,
          }
        : null,
    [rangeValid, projectId, from, to],
  );

  useEffect(() => {
    if (!filters) {
      return;
    }
    const key = filtersKeyOf(filters);
    const background = liveReloadRef.current && overviewKeyRef.current === key;
    liveReloadRef.current = false;
    const controller = new AbortController();
    setLoading(true);
    if (!background) {
      setError(null);
    }

    getToken()
      .then((authToken) =>
        fetchAnalyticsOverview(apiBaseUrl, authToken || undefined, filters, controller.signal),
      )
      .then((result) => {
        if (controller.signal.aborted) {
          return;
        }
        overviewKeyRef.current = key;
        setOverview({ key, data: result });
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setLoading(false);
        if (background) {
          return;
        }
        setError({
          status: err instanceof AnnotationApiError ? err.status : null,
          message: err instanceof Error ? err.message : "Unable to load analytics.",
        });
      });

    return () => controller.abort();
  }, [apiBaseUrl, identity, getToken, filters, reloads.overview]);

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

  const filtersKey = filters ? filtersKeyOf(filters) : "";
  const status = deriveDashboardStatus({ overviewLoaded: overview !== null, error });
  const current = overview && overview.key === filtersKey ? overview.data : null;
  const refreshing = loading && current !== null;

  const reloadOverviewLive = useCallback(() => {
    liveReloadRef.current = true;
    setReloads((current) => bumpSections(current, ["overview"]));
  }, []);

  const streamState = useAnalyticsStream({
    apiBaseUrl,
    getToken,
    identity,
    scope: { projectId },
    enabled: status === "ready",
    onReload: reloadOverviewLive,
  });

  return (
    <div className="wpn-settings-tab wpn-dashboard">
      <div className="wpn-dashboard__filters">
        <SearchableSelect
          options={projectOptions}
          value={projectId}
          onChange={setProjectId}
          placeholder="Select project"
          searchPlaceholder="Search projects"
          ariaLabel="Filter by project"
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

      {isCustom && !customValid ? (
        <div className="wpn-users-notice" role="alert">
          <span>Choose a start date on or before the end date, spanning at most 366 days.</span>
        </div>
      ) : null}

      {filters ? (
        <DashboardStatusGate status={status} error={error} onRetry={refresh}>
          <KpiCards
            state={
              current ? { kind: "ready", kpis: current.kpis, refreshing } : { kind: "loading" }
            }
          />
          <PageVisitsTable
            key={`pages|${filtersKey}`}
            filters={filters}
            reloadToken={reloads.pages}
            projectName={projectName}
          />
          <TrendsChart days={current ? current.trends.days : null} />
          <div className="wpn-dashboard-top">
            <TopPagesTable
              rows={current ? current.topPages : null}
              refreshing={refreshing}
              projectName={projectName}
            />
            <TopUsersTable rows={current ? current.topUsers : null} refreshing={refreshing} />
          </div>
          <VisitLogTable
            key={`visits|${filtersKey}`}
            filters={filters}
            reloadToken={reloads.visitLog}
            userOptions={userOptions}
            pageOptions={pageOptions}
            projectName={projectName}
          />
        </DashboardStatusGate>
      ) : null}
    </div>
  );
}

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { fetchAuditPage } from "../../services/auditApi";
import { formatRelativeTime, formatTimestamp, getInitials } from "../../utils/format";
import {
  Icon,
  ListSearchBar,
  SearchableSelect,
  TablePagination,
  TableSkeleton,
  Tooltip,
  type SelectOption,
} from "../primitives";
import type { AuditRecord, AuditScope } from "../../types/audit.types";
import {
  ACTION_OPTIONS,
  ENTITY_OPTIONS,
  actionMeta,
  diffFields,
  entityLabel,
  shortId,
  summarize,
} from "./auditFormat";

const SCOPE_OPTIONS: SelectOption[] = [
  { value: "project", label: "This project" },
  { value: "organization", label: "Whole organization" },
];

const RANGE_OPTIONS: SelectOption[] = [
  { value: "", label: "All time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

const RANGE_HOURS: Record<string, number> = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 };

function rangeStart(range: string): string | undefined {
  const hours = RANGE_HOURS[range];
  if (!hours) {
    return undefined;
  }
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

export interface AuditHistoryPanelProps {
  embedded?: boolean;
}

export function AuditHistoryPanel({ embedded = false }: AuditHistoryPanelProps = {}) {
  const { config, activeAccount, setAuditHistoryOpen } = useAnnotationContext();
  const actorId = activeAccount?.id;
  const [entries, setEntries] = useState<AuditRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [scope, setScope] = useState<AuditScope>("project");
  const [range, setRange] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchAuditPage(
      config.apiBaseUrl,
      actorId,
      {
        projectId: config.projectId,
        scope,
        action: actionFilter || undefined,
        entityType: entityFilter || undefined,
        search: debouncedSearch || undefined,
        from: rangeStart(range),
        limit: pageSize,
        offset: (page - 1) * pageSize,
      },
      controller.signal,
    )
      .then((result) => {
        setEntries(result.entries);
        setTotal(result.total);
        setLoading(false);
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load audit history.");
        setLoading(false);
      });

    return () => controller.abort();
  }, [
    config.apiBaseUrl,
    config.projectId,
    actorId,
    scope,
    actionFilter,
    entityFilter,
    debouncedSearch,
    range,
    page,
    pageSize,
    reloadToken,
  ]);

  const filtersActive = useMemo(
    () => Boolean(actionFilter || entityFilter || debouncedSearch || range),
    [actionFilter, entityFilter, debouncedSearch, range],
  );

  const clearFilters = useCallback(() => {
    setActionFilter("");
    setEntityFilter("");
    setSearch("");
    setDebouncedSearch("");
    setRange("");
    setPage(1);
  }, []);

  return (
    <div
      className={[
        "wpn-audit-panel",
        embedded ? "wpn-audit-panel--embedded" : "",
        !embedded && fullscreen ? "wpn-audit-panel--fullscreen" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {embedded ? null : (
        <div className="wpn-users-panel__header">
          <span className="wpn-users-panel__heading">
            <Icon name="history" className="wpn-users-panel__heading-icon" />
            <span className="wpn-panel__title">Audit history</span>
            {loaded ? <span className="wpn-audit-count">{total}</span> : null}
          </span>
          <div className="wpn-users-panel__header-actions">
            <Tooltip label={loading ? "Refreshing..." : "Refresh"} placement="bottom">
              <button
                type="button"
                className="wpn-refresh-btn"
                aria-label="Refresh audit history"
                aria-busy={loading}
                disabled={loading}
                onClick={reload}
              >
                <Icon
                  name="refresh"
                  className={[
                    "wpn-refresh-btn__icon",
                    loading ? "wpn-icon-btn__icon--spinning" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
                {loading ? "Refreshing" : "Refresh"}
              </button>
            </Tooltip>
            <Tooltip label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"} placement="bottom">
              <button
                type="button"
                className="wpn-icon-btn"
                aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                onClick={() => setFullscreen((current) => !current)}
              >
                <Icon name={fullscreen ? "collapse" : "expand"} />
              </button>
            </Tooltip>
            <Tooltip label="Close" placement="bottom">
              <button
                type="button"
                className="wpn-icon-btn wpn-icon-btn--danger"
                aria-label="Close audit history"
                onClick={() => setAuditHistoryOpen(false)}
              >
                <Icon name="close" />
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      <div className="wpn-audit-filters">
        <ListSearchBar
          value={search}
          onValueChange={setSearch}
          onSubmit={() => setDebouncedSearch(search.trim())}
          onClear={() => {
            setSearch("");
            setDebouncedSearch("");
            setPage(1);
          }}
          placeholder="Search people, actions, targets"
          trailing={
            <>
              <SearchableSelect
                options={SCOPE_OPTIONS}
                value={scope}
                onChange={(next) => {
                  setScope((next || "project") as AuditScope);
                  setPage(1);
                }}
                placeholder="Scope"
                searchPlaceholder="Search scope"
                ariaLabel="Filter by scope"
              />
              <SearchableSelect
                options={ACTION_OPTIONS}
                value={actionFilter}
                onChange={(next) => {
                  setActionFilter(next);
                  setPage(1);
                }}
                placeholder="All actions"
                searchPlaceholder="Search actions"
                ariaLabel="Filter by action"
                clearable
              />
              <SearchableSelect
                options={ENTITY_OPTIONS}
                value={entityFilter}
                onChange={(next) => {
                  setEntityFilter(next);
                  setPage(1);
                }}
                placeholder="All entities"
                searchPlaceholder="Search entities"
                ariaLabel="Filter by entity"
                clearable
              />
              <SearchableSelect
                options={RANGE_OPTIONS}
                value={range}
                onChange={(next) => {
                  setRange(next);
                  setPage(1);
                }}
                placeholder="All time"
                searchPlaceholder="Search range"
                ariaLabel="Filter by time range"
                clearable
              />
              {filtersActive ? (
                <button type="button" className="wpn-btn wpn-btn--ghost" onClick={clearFilters}>
                  <Icon name="close" className="wpn-btn__icon" />
                  Clear
                </button>
              ) : null}
            </>
          }
        />
      </div>

      {error ? (
        <div className="wpn-users-notice" role="alert">
          <span>{error}</span>
          <button type="button" className="wpn-btn wpn-btn--ghost" onClick={reload}>
            <Icon name="refresh" className="wpn-btn__icon" />
            Retry
          </button>
        </div>
      ) : null}

      <div className="wpn-users-table-wrap">
        <table
          className={[
            "wpn-users-table",
            "wpn-audit-table",
            loading && loaded ? "wpn-users-table--refetching" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Who</th>
              <th scope="col">Action</th>
              <th scope="col">Target</th>
              <th scope="col">IP address</th>
              <th scope="col" className="wpn-users-table__actions-head">
                Details
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && !loaded ? (
              <TableSkeleton
                rows={Math.min(pageSize, 5)}
                columns={["text", "identity", "pill", "text", "text", "actions"]}
                label="Loading audit history..."
              />
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="wpn-users-table__empty">
                  <Icon name="history" className="wpn-users-table__empty-icon" />
                  <span>
                    {filtersActive
                      ? "No activity matches these filters."
                      : "No activity recorded yet."}
                  </span>
                  {filtersActive ? (
                    <button type="button" className="wpn-btn wpn-btn--ghost" onClick={clearFilters}>
                      <Icon name="refresh" className="wpn-btn__icon" />
                      Clear filters
                    </button>
                  ) : null}
                </td>
              </tr>
            ) : (
              entries.map((entry) => {
                const meta = actionMeta(entry.action);
                const changes = diffFields(entry);
                const isOpen = expanded === entry.auditId;
                const actor =
                  entry.actorName ?? (entry.actorUserId ? shortId(entry.actorUserId) : "System");
                const actorTitle = entry.actorUserId ?? undefined;
                return (
                  <Fragment key={entry.auditId}>
                    <tr>
                      <td className="wpn-users-table__muted">
                        <Tooltip label={formatTimestamp(entry.createdAt)} placement="top">
                          <span>{formatRelativeTime(entry.createdAt)}</span>
                        </Tooltip>
                      </td>
                      <td>
                        <div className="wpn-users-identity">
                          <span className="wpn-avatar wpn-avatar--fallback">
                            {getInitials(actor)}
                          </span>
                          <span className="wpn-users-identity__copy">
                            <span className="wpn-users-identity__name" title={actorTitle}>
                              {actor}
                            </span>
                            {entry.actorName && entry.actorUserId ? (
                              <span className="wpn-users-identity__email" title={actorTitle}>
                                {shortId(entry.actorUserId)}
                              </span>
                            ) : null}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`wpn-users-pill wpn-audit-pill--${meta.tone}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td>
                        <span className="wpn-users-org">{entityLabel(entry.entityType)}</span>
                        <span className="wpn-users-org__country">{summarize(entry)}</span>
                      </td>
                      <td className="wpn-users-table__muted wpn-audit-ip">
                        {entry.ipAddress ?? "—"}
                      </td>
                      <td>
                        <div className="wpn-users-actions">
                          <button
                            type="button"
                            className="wpn-users-action"
                            aria-label={isOpen ? "Hide details" : "Show details"}
                            aria-expanded={isOpen}
                            onClick={() =>
                              setExpanded((current) =>
                                current === entry.auditId ? null : entry.auditId,
                              )
                            }
                          >
                            <Icon name={isOpen ? "collapse" : "expand"} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr className="wpn-audit-details-row">
                        <td colSpan={6}>
                          <div className="wpn-audit-details">
                            <dl className="wpn-audit-meta">
                              <div className="wpn-audit-meta__item">
                                <dt>Occurred</dt>
                                <dd>{formatTimestamp(entry.createdAt)}</dd>
                              </div>
                              {entry.projectId ? (
                                <div className="wpn-audit-meta__item">
                                  <dt>Project</dt>
                                  <dd>{entry.projectId}</dd>
                                </div>
                              ) : null}
                              {entry.pageKey ? (
                                <div className="wpn-audit-meta__item">
                                  <dt>Page</dt>
                                  <dd>{entry.pageKey}</dd>
                                </div>
                              ) : null}
                              {entry.entityId ? (
                                <div className="wpn-audit-meta__item">
                                  <dt>{entityLabel(entry.entityType)} id</dt>
                                  <dd>{entry.entityId}</dd>
                                </div>
                              ) : null}
                              {entry.ipAddress ? (
                                <div className="wpn-audit-meta__item">
                                  <dt>IP address</dt>
                                  <dd>{entry.ipAddress}</dd>
                                </div>
                              ) : null}
                              {entry.userAgent ? (
                                <div className="wpn-audit-meta__item wpn-audit-meta__item--wide">
                                  <dt>User agent</dt>
                                  <dd>{entry.userAgent}</dd>
                                </div>
                              ) : null}
                            </dl>

                            {changes.length > 0 ? (
                              <table className="wpn-audit-changes">
                                <thead>
                                  <tr>
                                    <th scope="col">Field</th>
                                    <th scope="col">Before</th>
                                    <th scope="col">After</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {changes.map((change) => (
                                    <tr key={change.field}>
                                      <th scope="row">{change.field}</th>
                                      <td className="wpn-audit-changes__before">
                                        {change.before ?? "—"}
                                      </td>
                                      <td className="wpn-audit-changes__after">
                                        {change.after ?? "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p className="wpn-audit-details__empty">
                                No field-level changes recorded for this event.
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={page}
        pageSize={pageSize}
        totalItems={total}
        itemLabel="events"
        onPageChange={setPage}
        onPageSizeChange={(next) => {
          setPageSize(next);
          setPage(1);
        }}
      />
    </div>
  );
}

import { isDoneStatus } from "../../utils/status";
import { Icon, SearchableSelect, Switch, type SelectOption } from "../primitives";
import {
  DEFAULT_COMMENT_FILTERS,
  SORT_OPTIONS,
  type CommentFilters,
  type CommentResolution,
  type CommentSort,
  type CommentThread,
} from "./commentFilters";

interface CommentsSidebarProps {
  allThreads: CommentThread[];
  filters: CommentFilters;
  update: <K extends keyof CommentFilters>(key: K, value: CommentFilters[K]) => void;
  setFilters: (filters: CommentFilters) => void;
  authors: SelectOption[];
  statuses: SelectOption[];
}

export function CommentsSidebar({
  allThreads,
  filters,
  update,
  setFilters,
  authors,
  statuses,
}: CommentsSidebarProps) {
  const unresolvedCount = allThreads.filter(
    (thread) => !isDoneStatus(thread.annotation.status),
  ).length;
  const resolvedCount = allThreads.length - unresolvedCount;

  const resolutionOptions: SelectOption[] = [
    { value: "all", label: `All Comments (${allThreads.length})` },
    { value: "open", label: `Unresolved (${unresolvedCount})` },
    { value: "resolved", label: `Resolved (${resolvedCount})` },
  ];

  return (
    <nav className="wpn-comments-sidebar" aria-label="Comment filters">
      <div className="wpn-comments-sidebar__heading">
        <Icon name="settings" className="wpn-comments-sidebar__heading-icon" />
        Filters
      </div>

      <label className="wpn-comments-sidebar__field">
        <span className="wpn-comments-sidebar__field-label">Comment type</span>
        <SearchableSelect
          options={resolutionOptions}
          value={filters.resolution}
          onChange={(next) => update("resolution", (next || "all") as CommentResolution)}
          placeholder="All comments"
          searchPlaceholder="Search"
          ariaLabel="Filter by comment type"
          size="sm"
          clearable
          clearValue="all"
        />
      </label>

      <label className="wpn-comments-sidebar__field">
        <span className="wpn-comments-sidebar__field-label">Status</span>
        <SearchableSelect
          options={statuses}
          value={filters.status}
          onChange={(next) => update("status", next)}
          placeholder="Any status"
          searchPlaceholder="Search status"
          ariaLabel="Filter by status"
          size="sm"
          clearable
        />
      </label>

      <label className="wpn-comments-sidebar__field">
        <span className="wpn-comments-sidebar__field-label">Assignee</span>
        <SearchableSelect
          options={authors}
          value={filters.author}
          onChange={(next) => update("author", next)}
          placeholder="Anyone"
          searchPlaceholder="Search people"
          ariaLabel="Filter by assignee"
          size="sm"
          clearable
        />
      </label>

      <label className="wpn-comments-sidebar__field">
        <span className="wpn-comments-sidebar__field-label">Sort by</span>
        <SearchableSelect
          options={SORT_OPTIONS}
          value={filters.sort}
          onChange={(next) => update("sort", (next || "newest") as CommentSort)}
          placeholder="Sort"
          searchPlaceholder="Search sort"
          ariaLabel="Sort comments"
          size="sm"
          clearable
          clearValue="newest"
        />
      </label>

      <div className="wpn-comments-sidebar__divider" role="separator" />
      <div className="wpn-comments-sidebar__subheading">View</div>

      <span className="wpn-filter-switch wpn-filter-switch--block">
        <Switch
          label="My Items"
          checked={filters.mineOnly}
          onChange={(next) => update("mineOnly", next)}
        />
        <span className="wpn-filter-switch__text">My Items</span>
      </span>
      <span className="wpn-filter-switch wpn-filter-switch--block">
        <Switch
          label="Only this page"
          checked={filters.thisPageOnly}
          onChange={(next) => update("thisPageOnly", next)}
        />
        <span className="wpn-filter-switch__text">Only this page</span>
      </span>

      <button
        type="button"
        className="wpn-comments-sidebar__clear"
        onClick={() => setFilters(DEFAULT_COMMENT_FILTERS)}
      >
        <Icon name="reset" className="wpn-chip-toggle__icon" />
        Clear filters
      </button>
    </nav>
  );
}

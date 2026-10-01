import { Icon } from "../primitives";
import type { PageGroup } from "./commentFilters";

interface PageTabsRowProps {
  pageGroups: PageGroup[];
  activePageKey: string | null;
  onSelect: (pageKey: string) => void;
}

export function PageTabsRow({ pageGroups, activePageKey, onSelect }: PageTabsRowProps) {
  if (pageGroups.length === 0) {
    return null;
  }

  return (
    <section className="wpn-page-tiles-section">
      <h3 className="wpn-comments-full__section-title">Pages ({pageGroups.length})</h3>
      <div className="wpn-page-tiles" role="tablist" aria-label="Pages">
        {pageGroups.map((group) => (
          <button
            key={group.pageKey}
            type="button"
            role="tab"
            aria-selected={group.pageKey === activePageKey}
            className={
              group.pageKey === activePageKey ? "wpn-page-tile wpn-page-tile--active" : "wpn-page-tile"
            }
            onClick={() => onSelect(group.pageKey)}
          >
            <span className="wpn-page-tile__icon-badge">
              <Icon name="folder" className="wpn-page-tile__icon" />
            </span>
            <span className="wpn-page-tile__label" title={group.location}>
              {group.location}
            </span>
            <span className="wpn-page-tile__count">{group.threads.length}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

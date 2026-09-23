import { useRef, type KeyboardEvent } from "react";
import { Icon, type IconName } from "./Icon";

export interface TabDefinition {
  id: string;
  label: string;
  icon?: IconName;
  disabled?: boolean;
}

interface TabsProps {
  tabs: TabDefinition[];
  activeTabId: string;
  onChange: (tabId: string) => void;
  ariaLabel: string;
}

export function Tabs({ tabs, activeTabId, onChange, ariaLabel }: TabsProps) {
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const enabledTabs = tabs.filter((tab) => !tab.disabled);

  const focusAndSelect = (tabId: string) => {
    onChange(tabId);
    tabRefs.current.get(tabId)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (enabledTabs.length === 0) {
      return;
    }
    const currentIndex = enabledTabs.findIndex((tab) => tab.id === activeTabId);
    const first = enabledTabs[0];
    const last = enabledTabs[enabledTabs.length - 1];

    if (event.key === "ArrowRight") {
      event.preventDefault();
      const next = enabledTabs[(currentIndex + 1 + enabledTabs.length) % enabledTabs.length];
      if (next) {
        focusAndSelect(next.id);
      }
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      const next = enabledTabs[(currentIndex - 1 + enabledTabs.length) % enabledTabs.length];
      if (next) {
        focusAndSelect(next.id);
      }
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      if (first) {
        focusAndSelect(first.id);
      }
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      if (last) {
        focusAndSelect(last.id);
      }
    }
  };

  return (
    <div className="wpn-tabs" role="tablist" aria-label={ariaLabel} onKeyDown={handleKeyDown}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={(node) => {
            if (node) {
              tabRefs.current.set(tab.id, node);
            } else {
              tabRefs.current.delete(tab.id);
            }
          }}
          type="button"
          role="tab"
          id={`${ariaLabel}-tab-${tab.id}`}
          aria-selected={tab.id === activeTabId}
          aria-controls={`${ariaLabel}-panel-${tab.id}`}
          disabled={tab.disabled}
          tabIndex={tab.id === activeTabId ? 0 : -1}
          className={[
            "wpn-tabs__tab",
            tab.id === activeTabId ? "wpn-tabs__tab--active" : "",
            tab.disabled ? "wpn-tabs__tab--disabled" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => !tab.disabled && onChange(tab.id)}
        >
          {tab.icon ? <Icon name={tab.icon} className="wpn-tabs__tab-icon" /> : null}
          <span className="wpn-tabs__tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

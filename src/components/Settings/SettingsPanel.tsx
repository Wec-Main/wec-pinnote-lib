import { useMemo, useState } from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { Icon, Tooltip } from "../primitives";
import { UserManagementPanel } from "../UserManagement/UserManagementPanel";
import { OrganizationsTab } from "./OrganizationsTab";
import { ProjectsTab } from "./ProjectsTab";
import { AuditHistoryPanel } from "../AuditHistory";
import { visibleSettingsTabs, type SettingsTab } from "./settingsTabs";
import { roleLabel } from "../../data/userManagementOptions";
import { getInitials } from "../../utils/format";

export function SettingsPanel() {
  const { activeAccount, setUserManagementOpen } = useAnnotationContext();
  const [tab, setTab] = useState<SettingsTab>("users");
  const [minimized, setMinimized] = useState(false);

  const tabs = useMemo(
    () => visibleSettingsTabs(activeAccount?.roleId ?? "developer"),
    [activeAccount?.roleId],
  );

  const activeTab = tabs.some((item) => item.id === tab) ? tab : "users";

  if (!activeAccount) {
    return (
      <div className="wpn-settings-panel">
        <div className="wpn-settings-panel__signin">
          <Icon name="users" className="wpn-users-table__empty-icon" />
          <span>Sign in to manage users.</span>
          <button
            type="button"
            className="wpn-btn wpn-btn--ghost"
            onClick={() => setUserManagementOpen(false)}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={["wpn-settings-panel", minimized ? "wpn-settings-panel--minimized" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <aside className="wpn-settings-sidebar">
        <div className="wpn-settings-sidebar__brand">
          <Icon name="settings" className="wpn-settings-sidebar__brand-icon" />
          <span className="wpn-settings-sidebar__brand-text">Settings</span>
        </div>

        <nav className="wpn-settings-nav" aria-label="Settings sections">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              className={[
                "wpn-settings-nav__item",
                activeTab === item.id ? "wpn-settings-nav__item--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-current={activeTab === item.id ? "page" : undefined}
              onClick={() => setTab(item.id)}
            >
              <Icon name={item.icon} className="wpn-settings-nav__icon" />
              <span className="wpn-settings-nav__label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="wpn-settings-sidebar__account">
          <span className="wpn-settings-sidebar__avatar">{getInitials(activeAccount.name)}</span>
          <span className="wpn-settings-sidebar__account-copy">
            <span className="wpn-settings-sidebar__account-name">{activeAccount.name}</span>
            <span className="wpn-settings-sidebar__account-role">
              {roleLabel(activeAccount.roleId)}
            </span>
          </span>
        </div>
      </aside>

      <section className="wpn-settings-body">
        <header className="wpn-settings-body__header">
          <h2 className="wpn-settings-body__title">
            {tabs.find((item) => item.id === activeTab)?.label}
          </h2>
          <div className="wpn-users-panel__header-actions">
            <Tooltip label={minimized ? "Maximize" : "Minimize"} placement="bottom">
              <button
                type="button"
                className="wpn-icon-btn"
                aria-label={minimized ? "Maximize settings" : "Minimize settings"}
                onClick={() => setMinimized((value) => !value)}
              >
                <Icon name={minimized ? "expand" : "windowMinimize"} />
              </button>
            </Tooltip>
            <Tooltip label="Close" placement="bottom">
              <button
                type="button"
                className="wpn-icon-btn wpn-icon-btn--danger"
                aria-label="Close settings"
                onClick={() => setUserManagementOpen(false)}
              >
                <Icon name="close" />
              </button>
            </Tooltip>
          </div>
        </header>

        {activeTab === "users" ? <UserManagementPanel /> : null}
        {activeTab === "organizations" ? <OrganizationsTab /> : null}
        {activeTab === "projects" ? <ProjectsTab /> : null}
        {activeTab === "audit" ? <AuditHistoryPanel embedded /> : null}
      </section>
    </div>
  );
}

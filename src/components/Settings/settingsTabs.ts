import type { IconName } from "../primitives";
import type { UserManagementRole } from "../../types/userManagement.types";
import { canManageOrganizations, canManageTags, canViewProjects } from "../../utils/permissions";

export type SettingsTab =
  "users" | "organizations" | "projects" | "tags" | "integrations" | "audit" | "dashboard";

interface SettingsTabDefinition {
  id: SettingsTab;
  label: string;
  icon: IconName;
}

const ALL_TABS: SettingsTabDefinition[] = [
  { id: "users", label: "Users", icon: "users" },
  { id: "organizations", label: "Organizations", icon: "building" },
  { id: "projects", label: "Projects", icon: "folder" },
  { id: "tags", label: "Tags", icon: "epic" },
  { id: "integrations", label: "Integrations", icon: "plug" },
  { id: "audit", label: "Audit history", icon: "history" },
  { id: "dashboard", label: "Dashboard", icon: "layers" },
];

const HIDDEN_TABS = new Set<SettingsTab>(["tags"]);

export function visibleSettingsTabs(role: UserManagementRole): SettingsTabDefinition[] {
  let tabs = ALL_TABS;
  if (!canManageOrganizations(role)) {
    const allowed = new Set<SettingsTab>(["users", "integrations"]);
    if (canViewProjects(role)) {
      allowed.add("projects");
    }
    if (canManageTags(role)) {
      allowed.add("tags");
    }
    tabs = ALL_TABS.filter((tab) => allowed.has(tab.id));
  }
  return tabs.filter((tab) => !HIDDEN_TABS.has(tab.id));
}

import type { IconName } from "../primitives";
import type { UserManagementRole } from "../../types/userManagement.types";
import { canManageOrganizations, canManageTags } from "../../utils/permissions";

export type SettingsTab = "users" | "organizations" | "projects" | "tags" | "audit" | "dashboard";

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
  { id: "audit", label: "Audit history", icon: "history" },
  { id: "dashboard", label: "Dashboard", icon: "layers" },
];

// Tags is hidden from the settings nav per product request, without removing
// the underlying feature/code.
const HIDDEN_TABS = new Set<SettingsTab>(["tags"]);

export function visibleSettingsTabs(role: UserManagementRole): SettingsTabDefinition[] {
  let tabs = ALL_TABS;
  if (!canManageOrganizations(role)) {
    const allowed = new Set<SettingsTab>(canManageTags(role) ? ["users", "tags"] : ["users"]);
    tabs = ALL_TABS.filter((tab) => allowed.has(tab.id));
  }
  return tabs.filter((tab) => !HIDDEN_TABS.has(tab.id));
}

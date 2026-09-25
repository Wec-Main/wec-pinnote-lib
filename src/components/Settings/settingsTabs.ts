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

export function visibleSettingsTabs(role: UserManagementRole): SettingsTabDefinition[] {
  if (canManageOrganizations(role)) {
    return ALL_TABS;
  }
  const allowed = new Set<SettingsTab>(canManageTags(role) ? ["users", "tags"] : ["users"]);
  return ALL_TABS.filter((tab) => allowed.has(tab.id));
}

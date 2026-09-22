import type { IconName } from "../primitives";
import type { UserManagementRole } from "../../types/userManagement.types";
import { canManageOrganizations } from "../../utils/permissions";

export type SettingsTab = "users" | "organizations" | "projects" | "audit";

interface SettingsTabDefinition {
  id: SettingsTab;
  label: string;
  icon: IconName;
}

const ALL_TABS: SettingsTabDefinition[] = [
  { id: "users", label: "Users", icon: "users" },
  { id: "organizations", label: "Organizations", icon: "building" },
  { id: "projects", label: "Projects", icon: "folder" },
  { id: "audit", label: "Audit history", icon: "history" },
];

export function visibleSettingsTabs(role: UserManagementRole): SettingsTabDefinition[] {
  return canManageOrganizations(role) ? ALL_TABS : ALL_TABS.filter((tab) => tab.id === "users");
}

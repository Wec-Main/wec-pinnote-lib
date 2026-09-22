import type { UserManagementRole, UserManagementStatus } from "../types/userManagement.types";

export const USER_ROLE_OPTIONS: { value: UserManagementRole; label: string }[] = [
  { value: "super_admin", label: "Super admin" },
  { value: "admin", label: "Admin" },
  { value: "contributor", label: "Contributor" },
  { value: "reviewer", label: "Reviewer" },
  { value: "developer", label: "Developer" },
];

export const USER_STATUS_OPTIONS: { value: UserManagementStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const LEGACY_STATUS_LABELS: Record<string, string> = { invited: "Invited" };

const LEGACY_ROLE_LABELS: Record<string, string> = { viewer: "Viewer" };

export const USER_COUNTRY_OPTIONS: [{ value: string; label: string }, ...{ value: string; label: string }[]] = [
  { value: "IN", label: "India" },
  { value: "GB", label: "United Kingdom" },
  { value: "DE", label: "Germany" },
  { value: "HK", label: "Hong Kong" },
  { value: "US", label: "United States" },
];

export function roleLabel(role: UserManagementRole): string {
  return (
    USER_ROLE_OPTIONS.find((option) => option.value === role)?.label ??
    LEGACY_ROLE_LABELS[role] ??
    role
  );
}

export function userStatusLabel(status: UserManagementStatus): string {
  return (
    USER_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    LEGACY_STATUS_LABELS[status] ??
    status
  );
}

export function countryLabel(code: string): string {
  return USER_COUNTRY_OPTIONS.find((option) => option.value === code)?.label ?? code;
}

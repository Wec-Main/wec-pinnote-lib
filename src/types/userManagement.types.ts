export type UserManagementStatus = "active" | "inactive" | "invited";

export type UserManagementRole =
  | "super_admin"
  | "admin"
  | "contributor"
  | "reviewer"
  | "developer";

export interface ManagedUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  roleId: UserManagementRole;
  status: UserManagementStatus;
  organizationId?: string;
  countryCode: string;
  avatarUrl?: string;
  lastActiveAt?: string;
  projects: UserProjectRef[];
  createdAt: string;
  updatedAt: string;
}

export interface UserProjectRef {
  id: string;
  name: string;
}

export interface ManagedUserDraft {
  organizationId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  roleId: UserManagementRole;
  status: UserManagementStatus;
  countryCode: string;
  password?: string;
  projectIds: string[];
}

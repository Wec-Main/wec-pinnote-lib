import type { ManagedUser, UserManagementRole } from "../types/userManagement.types";

export type UserScope = "all" | "self";

const MANAGEABLE_ROLES: Record<UserManagementRole, readonly UserManagementRole[]> = {
  super_admin: ["super_admin", "admin", "contributor", "reviewer", "developer"],
  admin: ["contributor"],
  contributor: [],
  reviewer: [],
  developer: [],
};

export function canReadAllUsers(actorRole: UserManagementRole): boolean {
  return actorRole === "super_admin" || actorRole === "admin";
}

export function userScopeFor(actorRole: UserManagementRole): UserScope {
  return canReadAllUsers(actorRole) ? "all" : "self";
}

export function assignableRoles(actorRole: UserManagementRole): readonly UserManagementRole[] {
  return MANAGEABLE_ROLES[actorRole];
}

export function canCreateUsers(actorRole: UserManagementRole): boolean {
  return MANAGEABLE_ROLES[actorRole].length > 0;
}

export function canManageRole(
  actorRole: UserManagementRole,
  targetRole: UserManagementRole,
): boolean {
  return MANAGEABLE_ROLES[actorRole].includes(targetRole);
}

function managesOther(
  actorRole: UserManagementRole,
  actorUserId: string,
  target: Pick<ManagedUser, "id" | "roleId">,
): boolean {
  return target.id !== actorUserId && canManageRole(actorRole, target.roleId);
}

export function canEditUser(
  actorRole: UserManagementRole,
  actorUserId: string,
  target: Pick<ManagedUser, "id" | "roleId">,
): boolean {
  return target.id === actorUserId || canManageRole(actorRole, target.roleId);
}

export const canDeleteUser = managesOther;

/**
 * Role and status are privileges, so they stay read-only unless the actor
 * manages the target outright. Editing yourself never grants them.
 */
export function canChangePrivileges(
  actorRole: UserManagementRole,
  actorUserId: string,
  target: Pick<ManagedUser, "id" | "roleId"> | null,
): boolean {
  return target ? managesOther(actorRole, actorUserId, target) : canCreateUsers(actorRole);
}

export function canManageOrganizations(actorRole: UserManagementRole): boolean {
  return actorRole === "super_admin";
}

export function canManageTags(actorRole: UserManagementRole): boolean {
  return actorRole === "super_admin" || actorRole === "admin";
}

import { describe, expect, it } from "vitest";
import {
  assignableRoles,
  canChangePrivileges,
  canCreateUsers,
  canDeleteUser,
  canEditUser,
  canManageOrganizations,
  userScopeFor,
} from "../src/utils/permissions";
import type { UserManagementRole } from "../src/types/userManagement.types";

const ROLES: UserManagementRole[] = [
  "super_admin",
  "admin",
  "contributor",
  "reviewer",
  "developer",
];

const ME = "me";
const SOMEONE = "someone";

describe("settings tabs", () => {
  it("gives organization and project management to super admin only", () => {
    expect(canManageOrganizations("super_admin")).toBe(true);
    for (const role of ["admin", "contributor", "reviewer", "developer"] as const) {
      expect(canManageOrganizations(role)).toBe(false);
    }
  });
});

describe("roster visibility", () => {
  it("shows the full roster to super admin and admin", () => {
    expect(userScopeFor("super_admin")).toBe("all");
    expect(userScopeFor("admin")).toBe("all");
  });

  it("shows only their own record to the remaining roles", () => {
    for (const role of ["contributor", "reviewer", "developer"] as const) {
      expect(userScopeFor(role)).toBe("self");
    }
  });
});

describe("creating users", () => {
  it("lets an admin create contributors only", () => {
    expect(assignableRoles("admin")).toEqual(["contributor"]);
    expect(canCreateUsers("admin")).toBe(true);
  });

  it("lets a super admin create every role", () => {
    expect([...assignableRoles("super_admin")].sort()).toEqual([...ROLES].sort());
  });

  it("offers no roles to contributor, reviewer or developer", () => {
    for (const role of ["contributor", "reviewer", "developer"] as const) {
      expect(canCreateUsers(role)).toBe(false);
    }
  });
});

describe("row actions", () => {
  const contributor = { id: SOMEONE, roleId: "contributor" as const };
  const reviewer = { id: SOMEONE, roleId: "reviewer" as const };

  it("lets an admin act on a contributor row", () => {
    expect(canEditUser("admin", ME, contributor)).toBe(true);
    expect(canDeleteUser("admin", ME, contributor)).toBe(true);
  });

  it("leaves a reviewer row read-only for an admin", () => {
    expect(canEditUser("admin", ME, reviewer)).toBe(false);
    expect(canDeleteUser("admin", ME, reviewer)).toBe(false);
  });

  it("lets every role edit its own row", () => {
    for (const role of ROLES) {
      expect(canEditUser(role, ME, { id: ME, roleId: role })).toBe(true);
    }
  });

  it("never offers delete on your own row", () => {
    for (const role of ROLES) {
      expect(canDeleteUser(role, ME, { id: ME, roleId: role })).toBe(false);
    }
  });
});

describe("privilege fields", () => {
  it("locks role and status when editing yourself, even as super admin", () => {
    expect(canChangePrivileges("super_admin", ME, { id: ME, roleId: "super_admin" })).toBe(false);
    expect(canChangePrivileges("admin", ME, { id: ME, roleId: "admin" })).toBe(false);
  });

  it("allows them when a super admin edits someone else", () => {
    expect(canChangePrivileges("super_admin", ME, { id: SOMEONE, roleId: "admin" })).toBe(true);
  });

  it("allows them for an admin only on a contributor", () => {
    expect(canChangePrivileges("admin", ME, { id: SOMEONE, roleId: "contributor" })).toBe(true);
    expect(canChangePrivileges("admin", ME, { id: SOMEONE, roleId: "reviewer" })).toBe(false);
  });

  it("follows creation rights when there is no target yet", () => {
    expect(canChangePrivileges("admin", ME, null)).toBe(true);
    expect(canChangePrivileges("developer", ME, null)).toBe(false);
  });
});

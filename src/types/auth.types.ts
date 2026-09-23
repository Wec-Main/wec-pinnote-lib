import type { UserManagementRole } from "./userManagement.types";

export interface LoginOption {
  id: string;
  name: string;
  email?: string;
  roleId?: UserManagementRole;
  organizationId?: string;
  avatarUrl?: string;
}

export interface AuthSession {
  id: string;
  name: string;
  email: string;
  roleId: UserManagementRole;
  organizationId?: string;
  avatarUrl?: string;
  token: string;
  refreshToken: string;
}

export interface AuthApiClient {
  listLoginOptions(projectId: string, signal?: AbortSignal): Promise<LoginOption[]>;
  login(
    projectId: string,
    userId: string,
    password: string,
    signal?: AbortSignal,
  ): Promise<AuthSession>;
  logout(projectId: string, userId: string, signal?: AbortSignal): Promise<void>;
  refresh(projectId: string, refreshToken: string, signal?: AbortSignal): Promise<string>;
}

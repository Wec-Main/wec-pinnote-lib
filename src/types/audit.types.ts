export interface AuditRecord {
  auditId: string;
  actorUserId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  organizationId: string | null;
  projectId: string | null;
  pageKey: string | null;
  beforeData: unknown;
  afterData: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export type AuditScope = "project" | "organization";

export interface AuditQuery {
  projectId: string;
  scope?: AuditScope;
  actorUserId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  pageKey?: string;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface AuditPage {
  entries: AuditRecord[];
  total: number;
  limit: number;
  offset: number;
}

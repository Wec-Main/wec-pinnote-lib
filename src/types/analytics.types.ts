import type { AnnotationStatus } from "./annotation.types";

export interface AnalyticsFilters {
  organizationId?: string;
  projectId?: string;
  from?: string;
  to?: string;
}

export type AnnotationStatusCounts = Record<AnnotationStatus, number>;

export interface AnalyticsSummary {
  range: { from: string; to: string };
  users: { total: number };
  activeNow: number;
  activeUsers: { dau: number; wau: number; mau: number };
  logins: { total: number; unique: number; failed: number };
  comments: { total: number };
  annotations: { total: number; byStatus: AnnotationStatusCounts };
  visits: { total: number };
}

export interface PageVisitRow {
  projectId: string;
  pageKey: string;
  visits: number;
  totalDurationMs: number;
  avgDurationMs: number;
}

export interface PageVisitPage {
  pages: PageVisitRow[];
  total: number | null;
  limit: number;
  offset: number;
}

export interface PagesQuery extends AnalyticsFilters {
  limit?: number;
  offset?: number;
}

export interface TrendDay {
  day: string;
  visits: number;
  logins: number;
  comments: number;
}

export interface AnalyticsTrends {
  days: TrendDay[];
}

export interface TopUserRecord {
  userId: string;
  userName: string;
  visits: number;
  activeDays: number;
  lastVisitDay: string;
}

export interface TopUsersPage {
  users: TopUserRecord[];
  total: number | null;
  limit: number;
  offset: number;
}

export interface UsersQuery extends AnalyticsFilters {
  limit?: number;
  offset?: number;
}

export interface VisitRecord {
  visitId: string;
  sessionId: string;
  userId: string;
  userName: string;
  organizationId: string;
  projectId: string;
  pageKey: string;
  urlPath: string;
  title: string | null;
  referrer: string | null;
  enteredAt: string;
  durationMs: number;
  maxScrollDepth: number;
  viewportWidth: number | null;
  viewportHeight: number | null;
  language: string | null;
  timezone: string | null;
  isContinuation: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  receivedAt: string;
}

export interface VisitsPage {
  visits: VisitRecord[];
  total: number | null;
  limit: number;
  offset: number;
}

export interface VisitsQuery extends AnalyticsFilters {
  userId?: string;
  pageKey?: string;
  limit?: number;
  offset?: number;
}

export type ExportVisitsQuery = AnalyticsFilters & { userId?: string; pageKey?: string };

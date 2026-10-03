import type { AnnotationStatus } from "./annotation.types";

export interface AnalyticsFilters {
  organizationId?: string;
  projectId?: string;
  from?: string;
  to?: string;
}

export type AnnotationStatusCounts = Record<AnnotationStatus, number>;

export interface AnalyticsKpis {
  users: { total: number };
  logins: { total: number; unique: number; failed: number };
  comments: { total: number };
  annotations: { total: number; byStatus: AnnotationStatusCounts };
}

export interface TrendDay {
  day: string;
  visits: number;
  logins: number;
  comments: number;
}

export interface PageVisitRow {
  projectId: string;
  pageKey: string;
  visits: number;
  avgDurationMs: number;
}

export interface TopUserRecord {
  userId: string;
  userName: string;
  visits: number;
  activeDays: number;
  lastVisitDay: string;
}

export interface AnalyticsOverview {
  range: { from: string; to: string };
  kpis: AnalyticsKpis;
  trends: { days: TrendDay[] };
  topPages: PageVisitRow[];
  topUsers: TopUserRecord[];
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

export interface VisitRecord {
  visitId: string;
  userId: string;
  userName: string;
  projectId: string;
  pageKey: string;
  urlPath: string;
  enteredAt: string;
  durationMs: number;
  maxScrollDepth: number;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface VisitsPage {
  visits: VisitRecord[];
  total: number;
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

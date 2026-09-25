export interface PageVisitRecord {
  clientVisitId: string;
  sessionId: string;
  pageKey: string;
  urlPath: string;
  title: string | null;
  referrer: string | null;
  enteredAt: string;
  durationMs: number;
  maxScrollDepth: number;
  viewportWidth: number;
  viewportHeight: number;
  language: string | null;
  timezone: string | null;
  continuation: boolean;
}

export interface IngestBatch {
  token: string;
  visits: PageVisitRecord[];
}

export interface OpenPageView {
  pageKey: string;
  urlPath: string;
  referrer: string | null;
  enteredAtMs: number;
  clientVisitId: string;
  sessionId: string;
  maxScrollDepth: number;
  viewportWidth: number;
  viewportHeight: number;
  language: string | null;
  timezone: string | null;
  continuation: boolean;
}

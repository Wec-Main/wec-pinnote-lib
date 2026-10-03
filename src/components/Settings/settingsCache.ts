import { prefetchAiActionTemplates, prefetchAiMe, prefetchAiSessions } from "../../ai/prefetch";
import type { AiPrefetchTarget } from "../../ai/prefetch";
import { fetchOrganizations, fetchProjects } from "../../services/organizationsApi";
import { prefetchResource } from "../../utils/resourceCache";
import type { Organization, Project } from "../../types/organization.types";
import type { SettingsTab } from "./settingsTabs";

const TABLE_TTL_MS = 30_000;

export function organizationsTableKey(apiBaseUrl: string, token: string | undefined): string {
  return `settings:organizations:${apiBaseUrl}:${token ?? ""}`;
}

export function projectsTableKey(
  apiBaseUrl: string,
  token: string | undefined,
  organizationId: string,
): string {
  return `settings:projects:${apiBaseUrl}:${token ?? ""}:${organizationId}`;
}

export interface SettingsPrefetchContext {
  apiBaseUrl: string;
  token: string | undefined;
  ai: AiPrefetchTarget | null;
}

export function prefetchSettingsTab(tab: SettingsTab, context: SettingsPrefetchContext): void {
  const { apiBaseUrl, token, ai } = context;
  if (tab === "organizations") {
    void prefetchResource<Organization[]>(
      `${organizationsTableKey(apiBaseUrl, token)}|`,
      (signal) => fetchOrganizations(apiBaseUrl, token, signal),
      { ttlMs: TABLE_TTL_MS, retries: 0 },
    );
  } else if (tab === "projects") {
    void prefetchResource<Project[]>(
      `${projectsTableKey(apiBaseUrl, token, "")}|`,
      (signal) => fetchProjects(apiBaseUrl, token, undefined, signal),
      { ttlMs: TABLE_TTL_MS, retries: 0 },
    );
  } else if (tab === "integrations" && ai) {
    void prefetchAiMe(ai);
    void prefetchAiActionTemplates(ai);
    void prefetchAiSessions(ai);
  }
}

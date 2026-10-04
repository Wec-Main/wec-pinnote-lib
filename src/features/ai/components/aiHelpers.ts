import { isValidModelId } from "../modelValidation";
import { getProvider, listProviderIds } from "../providerRegistry";
import {
  AI_ACTIVE_TURN_STATUSES,
  type AiActionRunState,
  type AiConnector,
  type AiMe,
  type AiModelInfo,
  type AiProviderId,
  type AiTurn,
} from "../../../types/ai.types";
import { AnnotationApiError } from "../../../types/annotation.types";

export function runStatusText(
  state: Pick<AiActionRunState, "steps" | "progress" | "text">,
): string {
  const step =
    [...state.steps].reverse().find((item) => item.status === "running") ??
    state.steps[state.steps.length - 1];
  const label = (step?.label ?? (state.text ? "Writing" : "Starting")).replace(/[.…]+$/, "");
  const detail = step?.status === "running" && step.detail ? ` · ${step.detail}` : "";
  const counted = state.progress > 0 ? ` · ${state.progress} so far` : "";
  return `${label}…${detail}${counted}`;
}

export function providerLabel(provider: string): string {
  const known = getProvider(provider)?.label;
  if (known) return known;
  return provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : "Agent";
}

export function providerDescription(provider: string): string {
  return getProvider(provider)?.description ?? "";
}

export function providerSignInLabel(provider: string): string {
  return getProvider(provider)?.signInLabel ?? providerLabel(provider);
}

function providerRank(provider: string): number {
  const known = listProviderIds();
  const index = known.indexOf(provider as AiProviderId);
  return index < 0 ? known.length : index;
}

export function sortProviders(providers: Iterable<AiProviderId>): AiProviderId[] {
  return [...new Set(providers)].sort(
    (a, b) => providerRank(a) - providerRank(b) || a.localeCompare(b),
  );
}

export function listedProviders(me: AiMe | null | undefined): AiProviderId[] {
  return sortProviders([
    ...listProviderIds(),
    ...(me?.providers ?? []),
    ...(me?.connectors ?? []).map((row) => row.provider),
  ]);
}

export const CONNECT_AGENT_HINT = "Connect Claude, Codex or Gemini in Settings → Integrations.";

export function connectAgentHint(_me?: AiMe | null): string {
  return CONNECT_AGENT_HINT;
}

const time = (value: string | null | undefined) => (value ? Date.parse(value) || 0 : 0);

export function enabledProviders(me: AiMe | null | undefined): AiProviderId[] {
  const enabled = me?.providers;
  if (!enabled || enabled.length === 0) return listProviderIds();
  return sortProviders(enabled);
}

export function allowedConnectors(me: AiMe | null | undefined): AiConnector[] {
  if (!me) return [];
  const rows = me.connectors ?? [];
  return enabledProviders(me)
    .map((provider) => rows.find((row) => row.provider === provider))
    .filter((row): row is AiConnector => Boolean(row));
}

export function connectorFor(
  me: AiMe | null | undefined,
  provider: AiProviderId,
): AiConnector | null {
  return me?.connectors?.find((row) => row.provider === provider) ?? null;
}

export function isConnected(connector: AiConnector | null | undefined): boolean {
  return connector?.status === "connected";
}

export function effectiveConnector(
  me: AiMe | null | undefined,
  provider: AiProviderId,
): AiConnector | null {
  const personal = connectorFor(me, provider);
  return isConnected(personal) ? personal : null;
}

export function connectedProviders(me: AiMe | null | undefined): AiProviderId[] {
  if (!me) return [];
  return enabledProviders(me).filter((provider) => effectiveConnector(me, provider) !== null);
}

export function aiReady(me: AiMe | null | undefined): boolean {
  return Boolean(me?.canUseAi) && connectedProviders(me).length > 0;
}

export function modelsFor(me: AiMe | null | undefined, provider: AiProviderId): AiModelInfo[] {
  return effectiveConnector(me, provider)?.models ?? [];
}

export interface AiRoute {
  provider: AiProviderId;
  model: string;
  effort: string | null;
}

export interface AiRoutePreference {
  provider: AiProviderId | null;
  model: string | null;
  effort: string | null;
}

export function defaultModel(models: readonly AiModelInfo[]): AiModelInfo | null {
  return models.find((model) => model.isDefault) ?? models[0] ?? null;
}

export function defaultEffortFor(model: AiModelInfo | null | undefined): string | null {
  if (!model) return null;
  if (model.efforts.includes("medium")) return "medium";
  return model.defaultEffort ?? null;
}

export function resolveRoute(me: AiMe | null, preference: AiRoutePreference): AiRoute | null {
  const connected = connectedProviders(me);
  if (connected.length === 0) return null;
  const provider =
    preference.provider && connected.includes(preference.provider)
      ? preference.provider
      : (connected[0] as AiProviderId);
  const models = modelsFor(me, provider);
  const chosen =
    (preference.model && models.find((model) => model.id === preference.model)) ||
    defaultModel(models);
  const preferred = preference.model && isValidModelId(preference.model) ? preference.model : null;
  const model = chosen?.id ?? preferred ?? "default";
  const efforts = chosen?.efforts ?? [];
  const effort =
    preference.effort && efforts.includes(preference.effort)
      ? preference.effort
      : defaultEffortFor(chosen);
  return { provider, model, effort };
}

export function routeLabel(route: AiRoute | null, me: AiMe | null): string {
  if (!route) return "No agent connected";
  const model = modelsFor(me, route.provider).find((item) => item.id === route.model);
  const parts = [providerLabel(route.provider), model?.label ?? route.model];
  if (route.effort) parts.push(route.effort);
  return parts.join(" · ");
}

export function isActiveTurn(turn: AiTurn | null | undefined): boolean {
  return Boolean(turn && AI_ACTIVE_TURN_STATUSES.includes(turn.status));
}

export type AiErrorAction = "retry" | "switch_provider" | "integrations";

export const AI_ERROR_TEXT: Record<string, string> = {
  auth_expired: "The agent's sign-in expired. Reconnect it in Settings → Integrations, then retry.",
  connector_required: `That agent is not connected. ${CONNECT_AGENT_HINT}`,
  runtime_busy: "The AI is busy with other requests right now. Try again in a moment.",
  runtime_unavailable: "The AI is not available on the server right now. Try again later.",
  runner_lost: "The AI worker stopped unexpectedly. Retry to start again.",
  cli_missing: "This agent is not installed on the server right now.",
  rate_limited: "The provider is rate limiting you. Wait a moment, then retry or switch provider.",
  timeout: "The turn took too long and was stopped.",
  tool_limit: "The AI hit the tool call limit for one turn.",
  forbidden: "Your role or the org policy does not allow this.",
  provider_error: "The provider returned an error. Retry, or try another provider.",
  internal: "Something went wrong on our side. Retry in a moment.",
  schema_outdated:
    "The AI result could not be saved because the database is missing the latest AI changes. Ask an admin to run db/ai_workspace.sql.",
  session_reset: "The conversation context was reset. Retry to continue from here.",
  session_not_found: "This conversation no longer exists on the agent. Retry to start fresh.",
  interrupted: "The turn was interrupted before it finished.",
  stale_base_revision: "The document changed while the AI was working. Ask the AI again.",
  persist_failed: "The AI result could not be saved. Retry to run it again.",
  invalid_ops: "The AI proposed changes that are not valid. Ask the AI again.",
  template_conflict:
    "This prompt was changed by someone else. It has been reloaded; review it and save again.",
  op_batch_status_conflict: "This AI change was already updated elsewhere.",
};

const ERROR_ACTIONS: Record<string, AiErrorAction[]> = {
  auth_expired: ["integrations", "switch_provider"],
  connector_required: ["integrations", "switch_provider"],
  cli_missing: ["switch_provider", "integrations"],
  forbidden: [],
  runner_lost: ["retry"],
  stale_base_revision: ["retry"],
  persist_failed: ["retry"],
  invalid_ops: ["retry"],
  template_conflict: [],
  op_batch_status_conflict: [],
  rate_limited: ["retry", "switch_provider"],
  provider_error: ["retry", "switch_provider"],
  runtime_unavailable: ["retry", "switch_provider"],
};

const KNOWN_ERROR_CODE = new RegExp(`\\b(${Object.keys(AI_ERROR_TEXT).join("|")})\\b`, "i");

function codeFromBody(body: string | null): string | null {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body) as { code?: unknown; details?: { code?: unknown } | null };
    if (typeof parsed.code === "string" && parsed.code) return parsed.code;
    const nested = parsed.details?.code;
    if (typeof nested === "string" && nested) return nested;
  } catch {
    return null;
  }
  return null;
}

export function aiErrorCode(err: unknown): string | null {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === "string" && code) return code;
  }
  if (err instanceof AnnotationApiError) {
    const fromBody = codeFromBody(err.body);
    if (fromBody) return fromBody;
    const match = KNOWN_ERROR_CODE.exec(`${err.message} ${err.body ?? ""}`);
    if (match?.[1]) return match[1].toLowerCase();
    if (err.status === 429) return "rate_limited";
    if (err.status === 403) return "forbidden";
    if (err.status === 503) return "runtime_busy";
    return null;
  }
  return null;
}

export function aiErrorText(code: string | null | undefined, fallback: string): string {
  return (code && AI_ERROR_TEXT[code]) || fallback;
}

export function aiErrorActions(code: string | null | undefined): AiErrorAction[] {
  if (code && ERROR_ACTIONS[code]) return ERROR_ACTIONS[code] as AiErrorAction[];
  return ["retry", "switch_provider"];
}

export function describeAiError(err: unknown, fallback = "Something went wrong"): string {
  const code = aiErrorCode(err);
  if (code && AI_ERROR_TEXT[code]) return AI_ERROR_TEXT[code] as string;
  if (err instanceof AnnotationApiError) return err.message || fallback;
  return err instanceof Error && err.message ? err.message : fallback;
}

export function errorStatus(err: unknown): number | null {
  return err instanceof AnnotationApiError ? err.status : null;
}

export function formatDate(iso: string | null | undefined): string {
  const at = time(iso);
  if (!at) return "—";
  return new Date(at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatAgo(iso: string | null | undefined, now = Date.now()): string {
  const at = time(iso);
  if (!at) return "never";
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function formatCountdown(msLeft: number): string {
  const total = Math.max(0, Math.ceil(msLeft / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

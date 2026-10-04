import { isKnownProviderId } from "../features/ai/providerRegistry";
import { buildUrl, request, requestNoContent } from "./httpClient";
import { AnnotationApiError } from "../types/annotation.types";
import type {
  AiActionKey,
  AiActionTarget,
  AiActionInputSpec,
  AiActionOutputFormat,
  AiActionTemplate,
  AiActionTemplateDto,
  AiActionTemplateFields,
  AiActionTemplatePreview,
  AiActionTemplatePreviewRequest,
  AiCommentDraft,
  AiConnector,
  AiLoginStart,
  AiLoginStatus,
  AiMe,
  AiMessage,
  AiOpBatch,
  AiProviderId,
  AiScopeKind,
  AiSession,
  AiSessionDetail,
  AiTurn,
  CreateAiSessionRequest,
  SendAiMessageRequest,
  SendAiMessageResponse,
  SaveAiActionTemplateRequest,
  UpdateAiCommentDraftRequest,
  UpdateAiOpBatchRequest,
  UpdateAiSessionRequest,
} from "../types/ai.types";

export interface AiStreamTicket {
  ticket: string;
  expiresInSeconds: number;
}

export interface AiSessionListQuery {
  projectId: string;
  scopeKind?: AiScopeKind;
  scopeId?: string;
  mine?: boolean;
  kind?: "chat" | "actions" | "all";
  limit?: number;
}

export interface AiMessagePage {
  messages: AiMessage[];
  hasMore: boolean;
}

export interface CreateAiSessionResult {
  session: AiSession;
  detail: AiSessionDetail | null;
  sent: SendAiMessageResponse | null;
}

type CreateAiSessionResponse =
  AiSession | (AiSessionDetail & { message?: AiMessage; turn?: AiTurn });

const seg = encodeURIComponent;

function connectorPath(provider: AiProviderId, suffix = ""): string {
  return `/ai/connectors/${seg(provider)}${suffix}`;
}

function json(method: string, body: unknown): RequestInit {
  return { method, body: JSON.stringify(body) };
}

function sendBody(input: SendAiMessageRequest): SendAiMessageRequest {
  const { mode: _mode, mentions, selection, ...rest } = input;
  const body: SendAiMessageRequest = { ...rest };
  if (mentions && mentions.length > 0) body.mentions = mentions;
  if (selection) body.selection = selection;
  return body;
}

function createBody(input: CreateAiSessionRequest): Omit<CreateAiSessionRequest, "mode"> {
  const { mode: _mode, message, ...rest } = input;
  return message ? { ...rest, message: sendBody(message) } : rest;
}

function isSessionDetail(
  body: CreateAiSessionResponse,
): body is AiSessionDetail & { message?: AiMessage; turn?: AiTurn } {
  return "session" in body && Array.isArray((body as AiSessionDetail).messages);
}

function sentFromDetail(
  body: AiSessionDetail & { message?: AiMessage; turn?: AiTurn },
): SendAiMessageResponse | null {
  const turn = body.turn ?? body.session.activeTurn;
  if (!turn) return null;
  const message =
    body.message ??
    body.messages.find((item) => item.role === "user" && item.aiTurnId === turn.aiTurnId);
  return message ? { message, turn } : null;
}

function rejectsCreateMessage(err: unknown): boolean {
  return (
    err instanceof AnnotationApiError &&
    err.status === 400 &&
    /unrecognized key/i.test(err.body ?? "") &&
    /message/.test(err.body ?? "")
  );
}

export function fetchAiMe(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  signal?: AbortSignal,
): Promise<AiMe> {
  return request<AiMe>(buildUrl(apiBaseUrl, "/ai/me", { projectId }), authToken, { signal });
}

export function fetchAiConnectors(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  refresh = false,
  signal?: AbortSignal,
): Promise<AiConnector[]> {
  return request<AiConnector[]>(
    buildUrl(apiBaseUrl, "/ai/connectors", {
      projectId,
      refresh: refresh ? 1 : undefined,
    }),
    authToken,
    { signal },
  );
}

export function fetchConnectorStatus(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  provider: AiProviderId,
  refresh = false,
  signal?: AbortSignal,
): Promise<AiConnector> {
  return request<AiConnector>(
    buildUrl(apiBaseUrl, connectorPath(provider, "/status"), {
      projectId,
      refresh: refresh ? 1 : undefined,
    }),
    authToken,
    { signal },
  );
}

export function startConnectorLogin(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  provider: AiProviderId,
): Promise<AiLoginStart> {
  return request<AiLoginStart>(
    buildUrl(apiBaseUrl, connectorPath(provider, "/login"), { projectId }),
    authToken,
    json("POST", {}),
  );
}

export function getConnectorLoginStatus(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  provider: AiProviderId,
  loginId: string,
  signal?: AbortSignal,
): Promise<AiLoginStatus> {
  return request<AiLoginStatus>(
    buildUrl(apiBaseUrl, connectorPath(provider, `/login/${seg(loginId)}`), { projectId }),
    authToken,
    { signal },
  );
}

export function submitConnectorLoginCode(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  provider: AiProviderId,
  loginId: string,
  code: string,
): Promise<AiLoginStatus> {
  return request<AiLoginStatus>(
    buildUrl(apiBaseUrl, connectorPath(provider, `/login/${seg(loginId)}/code`), { projectId }),
    authToken,
    json("POST", { code }),
  );
}

export function cancelConnectorLogin(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  provider: AiProviderId,
  loginId: string,
): Promise<void> {
  return requestNoContent(
    buildUrl(apiBaseUrl, connectorPath(provider, `/login/${seg(loginId)}/cancel`), { projectId }),
    authToken,
    { method: "POST" },
  );
}

export function saveConnectorApiKey(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  provider: AiProviderId,
  apiKey: string,
): Promise<AiConnector> {
  return request<AiConnector>(
    buildUrl(apiBaseUrl, connectorPath(provider, "/api-key"), { projectId }),
    authToken,
    json("POST", { apiKey }),
  );
}

export function logoutConnector(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  provider: AiProviderId,
): Promise<AiConnector> {
  return request<AiConnector>(
    buildUrl(apiBaseUrl, connectorPath(provider, "/logout"), { projectId }),
    authToken,
    { method: "POST" },
  );
}

export function listAiSessions(
  apiBaseUrl: string,
  authToken: string | undefined,
  query: AiSessionListQuery,
  signal?: AbortSignal,
): Promise<AiSession[]> {
  return request<AiSession[]>(
    buildUrl(apiBaseUrl, "/ai/sessions", {
      projectId: query.projectId,
      scopeKind: query.scopeKind,
      scopeId: query.scopeId,
      mine: query.mine ? true : undefined,
      kind: query.kind && query.kind !== "chat" ? query.kind : undefined,
      limit: query.limit,
    }),
    authToken,
    { signal },
  );
}

export interface AiActionHistory {
  aiSessionId: string | null;
  messages: AiMessage[];
  hasMore: boolean;
}

export function getAiActionHistory(
  apiBaseUrl: string,
  authToken: string | undefined,
  query: {
    projectId: string;
    targetKind: AiActionTarget["kind"];
    targetId: string;
    aiSessionId?: string;
  },
  signal?: AbortSignal,
): Promise<AiActionHistory> {
  return request<AiActionHistory>(buildUrl(apiBaseUrl, "/ai/actions/history", query), authToken, {
    signal,
  });
}

export function listAiActionChats(
  apiBaseUrl: string,
  authToken: string | undefined,
  query: { projectId: string; targetKind: AiActionTarget["kind"]; targetId: string },
  signal?: AbortSignal,
): Promise<AiSession[]> {
  return request<AiSession[]>(buildUrl(apiBaseUrl, "/ai/actions/chats", query), authToken, {
    signal,
  });
}

export function createAiSession(
  apiBaseUrl: string,
  authToken: string | undefined,
  input: CreateAiSessionRequest,
): Promise<AiSession> {
  return request<AiSession>(
    buildUrl(apiBaseUrl, "/ai/sessions"),
    authToken,
    json("POST", createBody(input)),
  );
}

export async function createAiSessionWithMessage(
  apiBaseUrl: string,
  authToken: string | undefined,
  input: CreateAiSessionRequest,
): Promise<CreateAiSessionResult> {
  let body: CreateAiSessionResponse;
  try {
    body = await request<CreateAiSessionResponse>(
      buildUrl(apiBaseUrl, "/ai/sessions"),
      authToken,
      json("POST", createBody(input)),
    );
  } catch (err) {
    if (!input.message || !rejectsCreateMessage(err)) throw err;
    const { message: _message, ...rest } = input;
    const session = await createAiSession(apiBaseUrl, authToken, rest);
    return { session, detail: null, sent: null };
  }
  if (!isSessionDetail(body)) return { session: body, detail: null, sent: null };
  const sent = input.message ? sentFromDetail(body) : null;
  const { message: _message, turn: _turn, ...rest } = body;
  const detail: AiSessionDetail = sent
    ? { ...rest, session: { ...rest.session, activeTurn: rest.session.activeTurn ?? sent.turn } }
    : rest;
  return { session: detail.session, detail, sent };
}

export function fetchAiSession(
  apiBaseUrl: string,
  authToken: string | undefined,
  aiSessionId: string,
  signal?: AbortSignal,
): Promise<AiSessionDetail> {
  return request<AiSessionDetail>(
    buildUrl(apiBaseUrl, `/ai/sessions/${seg(aiSessionId)}`),
    authToken,
    { signal },
  );
}

export function fetchAiSessionMessages(
  apiBaseUrl: string,
  authToken: string | undefined,
  aiSessionId: string,
  page: { before?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<AiMessagePage> {
  return request<AiMessagePage>(
    buildUrl(apiBaseUrl, `/ai/sessions/${seg(aiSessionId)}/messages`, page),
    authToken,
    { signal },
  );
}

export function updateAiSession(
  apiBaseUrl: string,
  authToken: string | undefined,
  aiSessionId: string,
  input: UpdateAiSessionRequest,
): Promise<AiSession> {
  return request<AiSession>(
    buildUrl(apiBaseUrl, `/ai/sessions/${seg(aiSessionId)}`),
    authToken,
    json("PATCH", input),
  );
}

export function sendAiMessage(
  apiBaseUrl: string,
  authToken: string | undefined,
  aiSessionId: string,
  input: SendAiMessageRequest,
): Promise<SendAiMessageResponse> {
  return request<SendAiMessageResponse>(
    buildUrl(apiBaseUrl, `/ai/sessions/${seg(aiSessionId)}/messages`),
    authToken,
    json("POST", sendBody(input)),
  );
}

export function interruptAiSession(
  apiBaseUrl: string,
  authToken: string | undefined,
  aiSessionId: string,
): Promise<AiTurn> {
  return request<AiTurn>(
    buildUrl(apiBaseUrl, `/ai/sessions/${seg(aiSessionId)}/interrupt`),
    authToken,
    { method: "POST" },
  );
}

export function fetchAiOpBatch(
  apiBaseUrl: string,
  authToken: string | undefined,
  aiOpBatchId: string,
  signal?: AbortSignal,
): Promise<AiOpBatch> {
  return request<AiOpBatch>(buildUrl(apiBaseUrl, `/ai/op-batches/${seg(aiOpBatchId)}`), authToken, {
    signal,
  });
}

export function updateAiOpBatch(
  apiBaseUrl: string,
  authToken: string | undefined,
  aiOpBatchId: string,
  input: UpdateAiOpBatchRequest,
): Promise<AiOpBatch> {
  return request<AiOpBatch>(
    buildUrl(apiBaseUrl, `/ai/op-batches/${seg(aiOpBatchId)}`),
    authToken,
    json("PATCH", input),
  );
}

export function updateAiCommentDraft(
  apiBaseUrl: string,
  authToken: string | undefined,
  aiCommentDraftId: string,
  input: UpdateAiCommentDraftRequest,
): Promise<AiCommentDraft> {
  return request<AiCommentDraft>(
    buildUrl(apiBaseUrl, `/ai/comment-drafts/${seg(aiCommentDraftId)}`),
    authToken,
    json("PATCH", input),
  );
}

export function fetchAiStreamTicket(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  signal?: AbortSignal,
): Promise<AiStreamTicket> {
  return request<AiStreamTicket>(
    buildUrl(apiBaseUrl, "/ai/stream/ticket", { projectId }),
    authToken,
    { method: "POST", signal },
  );
}

function templatePath(actionKey: AiActionKey, suffix = ""): string {
  return `/ai/action-templates/${seg(actionKey)}${suffix}`;
}

const OUTPUT_FORMAT_IDS: readonly AiActionOutputFormat[] = ["json", "markdown", "text"];
const TARGET_KINDS: readonly NonNullable<AiActionTemplate["target"]>[] = [
  "annotation",
  "data_model",
  "flow",
];
type Loose = Record<string, unknown>;

const isRecord = (value: unknown): value is Loose =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;
const strOrNull = (value: unknown): string | null => (typeof value === "string" ? value : null);
const numOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

function toOutputFormat(value: unknown): AiActionOutputFormat {
  return OUTPUT_FORMAT_IDS.includes(value as AiActionOutputFormat)
    ? (value as AiActionOutputFormat)
    : "markdown";
}

function toInputSpec(value: unknown): AiActionInputSpec {
  const raw = isRecord(value) ? value : {};
  const limits: Record<string, number | boolean> = {};
  if (isRecord(raw.limits)) {
    for (const [key, limit] of Object.entries(raw.limits)) {
      if (typeof limit === "number" || typeof limit === "boolean") limits[key] = limit;
    }
  }
  return {
    ...raw,
    include: strings(raw.include),
    ...(isRecord(raw.limits) ? { limits } : {}),
  };
}

function toTemplateFields(raw: Loose): AiActionTemplateFields {
  const provider = strOrNull(raw.provider);
  return {
    name: str(raw.name),
    description: str(raw.description),
    systemPrompt: str(raw.systemPrompt),
    userTemplate: str(raw.userTemplate),
    inputSpec: toInputSpec(raw.inputSpec),
    outputFormat: toOutputFormat(raw.outputFormat),
    outputSchema: isRecord(raw.outputSchema) ? raw.outputSchema : null,
    provider: provider && isKnownProviderId(provider) ? provider : null,
    model: strOrNull(raw.model),
    effort: strOrNull(raw.effort),
    maxTokens: numOrNull(raw.maxTokens),
    temperature: numOrNull(raw.temperature),
    enabled: raw.enabled !== false,
  };
}

export function normalizeAiActionTemplate(value: AiActionTemplateDto | unknown): AiActionTemplate {
  const raw: Loose = isRecord(value) ? value : {};
  const fields = toTemplateFields(raw);
  const source = raw.source === "org" || raw.source === "global" ? raw.source : "fallback";
  const overridden = typeof raw.overridden === "boolean" ? raw.overridden : source === "org";
  const allowedFormats = strings(raw.allowedOutputFormats).filter(
    (item): item is AiActionOutputFormat =>
      OUTPUT_FORMAT_IDS.includes(item as AiActionOutputFormat),
  );
  const target = TARGET_KINDS.find((kind) => kind === raw.target) ?? null;
  const placeholders = strings(raw.placeholders);
  return {
    ...fields,
    actionKey: str(raw.actionKey) as AiActionKey,
    surface: str(raw.surface),
    version: numOrNull(raw.version) ?? 0,
    source,
    updatedAt: strOrNull(raw.updatedAt),
    isDefault: !overridden,
    defaults: isRecord(raw.defaultTemplate) ? toTemplateFields(raw.defaultTemplate) : null,
    runnable: raw.runnable !== false,
    target,
    allowedIncludes: strings(raw.allowedIncludes),
    allowedOutputFormats: allowedFormats.length > 0 ? allowedFormats : [fields.outputFormat],
    placeholders,
  };
}

export async function listAiActionTemplates(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  signal?: AbortSignal,
): Promise<AiActionTemplate[]> {
  const body = await request<unknown>(
    buildUrl(apiBaseUrl, "/ai/action-templates", { projectId }),
    authToken,
    { signal },
  );
  return Array.isArray(body) ? body.map(normalizeAiActionTemplate) : [];
}

export async function saveAiActionTemplate(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  actionKey: AiActionKey,
  input: SaveAiActionTemplateRequest,
): Promise<AiActionTemplate> {
  const body = await request<unknown>(
    buildUrl(apiBaseUrl, templatePath(actionKey), { projectId }),
    authToken,
    json("PUT", input),
  );
  return normalizeAiActionTemplate(body);
}

export async function resetAiActionTemplate(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  actionKey: AiActionKey,
): Promise<AiActionTemplate> {
  const body = await request<unknown>(
    buildUrl(apiBaseUrl, templatePath(actionKey), { projectId }),
    authToken,
    { method: "DELETE" },
  );
  return normalizeAiActionTemplate(body);
}

export async function previewAiActionTemplate(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  actionKey: AiActionKey,
  input: AiActionTemplatePreviewRequest,
): Promise<AiActionTemplatePreview> {
  const body = await request<unknown>(
    buildUrl(apiBaseUrl, templatePath(actionKey, "/preview"), { projectId }),
    authToken,
    json("POST", input),
  );
  const record: Loose = isRecord(body) ? body : {};
  return {
    systemPrompt: str(record.system),
    userPrompt: str(record.user),
    input: record.input ?? null,
    errors: strings(record.errors),
  };
}

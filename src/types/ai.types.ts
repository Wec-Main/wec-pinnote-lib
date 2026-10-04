import type { ErdOp, FlowOp, WorkspaceOp } from "../ai/ops/types";

export type AiProviderId = "claude" | "codex" | "gemini";
// The canonical list of built-in provider ids. The full descriptor for each
// (label, logo, auth copy, model catalog, …) lives in src/ai/providerRegistry.ts;
// this array only exists so ai.types.ts (a dependency-free leaf module, and part
// of this package's public API via src/index.ts) can keep exporting it unchanged.
export const AI_PROVIDERS: readonly AiProviderId[] = ["claude", "codex", "gemini"];
export const AI_KNOWN_PROVIDERS: readonly AiProviderId[] = AI_PROVIDERS;

export type AiMode = "model";

export type AiConnectorStatus = "connected" | "signed_out" | "not_installed" | "error";

export type AiConnectorAuth = "subscription" | "api_key" | null;

export type AiLoginMethod = "link_paste" | "device_code" | "browser";

export interface AiProviderAccount {
  email: string | null;
  plan: string | null;
  organization: string | null;
}

export interface AiModelInfo {
  id: string;
  label: string;
  description: string;
  efforts: string[];
  defaultEffort: string | null;
  isDefault: boolean;
}

export interface AiConnector {
  provider: AiProviderId;
  status: AiConnectorStatus;
  auth: AiConnectorAuth;
  account: AiProviderAccount | null;
  cliVersion: string | null;
  models: AiModelInfo[];
  error: string | null;
  connectedAt: string | null;
  checkedAt: string | null;
  lastUsedAt: string | null;
}

export interface AiMe {
  providers: AiProviderId[];
  connectors: AiConnector[];
  canUseAi: boolean;
  canApplyModelOps: boolean;
  canManageAiTemplates?: boolean;
}

export interface AiLoginStart {
  loginId: string | null;
  provider: AiProviderId;
  method: AiLoginMethod;
  url: string | null;
  userCode: string | null;
  needsCode: boolean;
  expiresAt: string;
  alreadyConnected?: boolean;
  connector?: AiConnector;
}

export type AiLoginState =
  "pending" | "awaiting_code" | "verifying" | "succeeded" | "failed" | "cancelled" | "expired";

export interface AiLoginStatus {
  loginId: string;
  provider: AiProviderId;
  state: AiLoginState;
  error: string | null;
  connector: AiConnector | null;
}

export type AiScopeKind = "project" | "data_model" | "flow" | "annotation" | "workspace";
export type AiVisibility = "project" | "private";

export type AiTurnStatus =
  "queued" | "dispatched" | "running" | "completed" | "failed" | "interrupted" | "cancelled";

export const AI_ACTIVE_TURN_STATUSES: readonly AiTurnStatus[] = ["queued", "dispatched", "running"];

export interface AiUsage {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  costUsd?: number;
}

export interface AiTurn {
  aiTurnId: string;
  aiSessionId: string;
  userId: string;
  userName: string | null;
  provider: AiProviderId;
  model: string;
  effort: string | null;
  mode: AiMode;
  status: AiTurnStatus;
  errorCode: string | null;
  errorMessage: string | null;
  usage: AiUsage | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface AiSession {
  aiSessionId: string;
  projectId: string;
  title: string;
  mode: AiMode;
  scopeKind: AiScopeKind;
  scopeId: string | null;
  provider: AiProviderId;
  model: string;
  effort: string | null;
  visibility?: AiVisibility;
  kind?: "chat" | "actions";
  createdById: string | null;
  createdByName: string | null;
  nativeSessionOwnerId: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  activeTurn: AiTurn | null;
}

export type AiMentionKind = "data_model" | "flow" | "annotation" | "epic" | "user_story" | "user";

export interface AiMention {
  kind: AiMentionKind;
  id: string;
  label: string;
}

export interface AiSelection {
  kind: "data_model" | "flow";
  id: string;
  itemIds: string[];
}

export interface AiQuestionOption {
  label: string;
  description?: string;
}

export interface AiQuestion {
  question: string;
  header?: string;
  options: AiQuestionOption[];
  multiSelect?: boolean;
}

export type AiMessageContent =
  | { type: "text"; text: string; mentions?: AiMention[]; selection?: AiSelection | null }
  | {
      type: "tool";
      toolCallId: string;
      name: string;
      status: "running" | "ok" | "error";
      summary: string;
    }
  | { type: "op_batch"; aiOpBatchId: string }
  | { type: "comment_draft"; aiCommentDraftId: string }
  | { type: "questions"; questions: AiQuestion[] }
  | { type: "notice"; level: "info" | "warning" | "error"; text: string; code?: string };

export type AiMessageRole = "user" | "assistant" | "tool" | "system";

export interface AiMessage {
  aiMessageId: string;
  aiSessionId: string;
  aiTurnId: string | null;
  authorId: string | null;
  authorName: string | null;
  role: AiMessageRole;
  content: AiMessageContent;
  createdAt: string;
  updatedAt: string;
}

export type AiOpBatchTargetKind = "data_model" | "flow" | "workspace";
export type AiEditorTargetKind = Exclude<AiOpBatchTargetKind, "workspace">;
export type AiOpBatchStatus =
  "proposed" | "applying" | "applied" | "saved" | "rejected" | "conflict" | "discarded";

export interface AiChangeSummary {
  added: number;
  changed: number;
  removed: number;
}

interface AiOpBatchBase {
  aiOpBatchId: string;
  aiSessionId: string;
  aiTurnId: string | null;
  targetId: string;
  baseRevision: number;
  title: string;
  rationale: string;
  summary: AiChangeSummary;
  status: AiOpBatchStatus;
  statusDetail: string | null;
  savedRevision: number | null;
  createdAt: string;
  updatedAt: string;
}

export type AiOpBatch =
  | (AiOpBatchBase & { targetKind: "data_model"; ops: ErdOp[] })
  | (AiOpBatchBase & { targetKind: "flow"; ops: FlowOp[] })
  | (AiOpBatchBase & { targetKind: "workspace"; ops: WorkspaceOp[] });

export type AiCommentDraftStatus = "draft" | "posted" | "discarded";

export interface AiCommentDraft {
  aiCommentDraftId: string;
  aiSessionId: string;
  aiTurnId: string | null;
  annotationId: string;
  annotationNumber: number | null;
  replyToCommentId: string | null;
  message: string;
  status: AiCommentDraftStatus;
  postedCommentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiSessionDetail {
  session: AiSession;
  messages: AiMessage[];
  hasMoreMessages: boolean;
  opBatches: AiOpBatch[];
  commentDrafts: AiCommentDraft[];
}

export interface CreateAiSessionRequest {
  projectId: string;
  title?: string;
  mode: AiMode;
  scopeKind: AiScopeKind;
  scopeId?: string | null;
  provider: AiProviderId;
  model: string;
  effort?: string | null;
  visibility?: AiVisibility;
}

export interface UpdateAiSessionRequest {
  title?: string;
  mode?: AiMode;
  provider?: AiProviderId;
  model?: string;
  effort?: string | null;
  visibility?: AiVisibility;
  archived?: boolean;
}

export interface SendAiMessageRequest {
  text: string;
  mentions?: AiMention[];
  selection?: AiSelection | null;
  mode?: AiMode;
  provider?: AiProviderId;
  model?: string;
  effort?: string | null;
  clientMessageId?: string;
}

export interface SendAiMessageResponse {
  message: AiMessage;
  turn: AiTurn;
}

export interface UpdateAiOpBatchRequest {
  status: Exclude<AiOpBatchStatus, "proposed">;
  savedRevision?: number;
  statusDetail?: string;
}

export interface UpdateAiCommentDraftRequest {
  status: Exclude<AiCommentDraftStatus, "draft">;
  postedCommentId?: string;
}

export type AiStreamEvent =
  | { type: "ai_session.upserted"; session: AiSession }
  | { type: "ai_session.deleted"; aiSessionId: string }
  | { type: "ai_message.upserted"; message: AiMessage }
  | { type: "ai_turn.upserted"; turn: AiTurn }
  | { type: "ai_op_batch.upserted"; batch: AiOpBatch }
  | { type: "ai_comment_draft.upserted"; draft: AiCommentDraft }
  | {
      type: "ai_delta";
      aiSessionId: string;
      aiTurnId: string;
      kind: "text" | "reasoning" | "status";
      text: string;
      seq: number;
      fromSeq?: number;
      part?: number;
      parts?: number;
    }
  | {
      type: "ai_snapshot";
      aiSessionId: string;
      aiTurnId: string;
      kind: "text";
      seq: number;
      offset: number;
      length: number;
      text: string;
    }
  | {
      type: "ai_open_in_editor";
      aiSessionId: string;
      aiTurnId: string;
      target: { kind: "data_model" | "flow"; id: string };
    }
  | { type: "ai_resync" }
  | { type: "ai_connectors.updated"; connectors: AiConnector[] }
  | ({ type: "ai_connector_login.updated" } & AiLoginStatus);

export type AiStreamEventType = AiStreamEvent["type"];

export type AiActionKey =
  | "chat"
  | "comment.summarize"
  | "comment.draft_reply"
  | "comment.improve"
  | "erd.generate"
  | "erd.edit"
  | "erd.review"
  | "erd.explain"
  | "flow.generate"
  | "flow.edit"
  | "flow.explain"
  | "workspace.assist";

export interface AiActionTarget {
  kind: "data_model" | "flow" | "annotation" | "workspace";
  id: string;
}

export interface AiActionRunRequest {
  sessionId?: string;
  newChat?: boolean;
  targetId?: string;
  prompt?: string;
  selection?: string[];
  provider?: AiProviderId;
  model?: string;
  effort?: string | null;
  inputs?: { draft?: string };
  template?: UpdateAiActionTemplateRequest;
  fresh?: boolean;
  mentions?: AiMention[];
}

export type AiActionStepStatus = "running" | "done" | "failed";

export interface AiActionStep {
  id: string;
  label: string;
  status: AiActionStepStatus;
  detail?: string;
}

export type AiActionResult =
  | { kind: "markdown" | "text"; text: string }
  | { kind: "op_batch"; batch: AiOpBatch; value: Record<string, unknown> }
  | { kind: "json"; value: Record<string, unknown> };

export interface AiActionUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  ttftMs: number;
  durationMs: number;
}

export interface AiActionError {
  code: string;
  message: string;
  retryable: boolean;
}

export type AiActionRunStatus = "completed" | "failed" | "cancelled";

export type AiActionEvent =
  | {
      type: "run.started";
      runId: string;
      actionKey: AiActionKey;
      provider: AiProviderId;
      target: AiActionTarget | null;
      model?: string;
      transport?: string;
    }
  | ({ type: "step" } & AiActionStep)
  | { type: "delta"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "progress"; ops: number; from?: number; newOps?: unknown[] }
  | ({ type: "result" } & AiActionResult)
  | ({ type: "usage" } & AiActionUsage)
  | ({ type: "error" } & AiActionError)
  | { type: "done"; runId: string; status: AiActionRunStatus | string };

export type AiActionEventType = AiActionEvent["type"];

export type AiActionUiStatus = "idle" | "running" | "done" | "error" | "cancelled";

export interface AiActionRunState {
  status: AiActionUiStatus;
  runId: string | null;
  actionKey: AiActionKey | null;
  provider: AiProviderId | null;
  model: string | null;
  steps: AiActionStep[];
  text: string;
  reasoning: string;
  progress: number;
  partialOps: unknown[];
  result: AiActionResult | null;
  usage: AiActionUsage | null;
  error: AiActionError | null;
  startedAt: number | null;
  finishedAt: number | null;
}

export type AiActionOutputFormat = "json" | "markdown" | "text";

export interface AiActionInputSpec {
  include: string[];
  limits?: Record<string, number | boolean>;
  filters?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AiActionTemplateFields {
  name: string;
  description: string;
  systemPrompt: string;
  userTemplate: string;
  inputSpec: AiActionInputSpec;
  outputFormat: AiActionOutputFormat;
  outputSchema: unknown;
  provider: AiProviderId | null;
  model: string | null;
  effort: string | null;
  maxTokens: number | null;
  temperature: number | null;
  enabled: boolean;
}

export type AiActionTemplateSource = "org" | "global" | "fallback";

export interface AiActionTemplateDto {
  actionKey: AiActionKey;
  name: string;
  description: string;
  surface: string;
  systemPrompt: string;
  userTemplate: string;
  inputSpec: Record<string, unknown>;
  outputFormat: AiActionOutputFormat;
  outputSchema: Record<string, unknown> | null;
  provider: string | null;
  model: string | null;
  effort: string | null;
  maxTokens: number | null;
  temperature: number | null;
  enabled: boolean;
  version: number;
  source: AiActionTemplateSource;
  updatedAt: string | null;
  overridden: boolean;
  runnable: boolean;
  target: AiActionTarget["kind"] | null;
  allowedIncludes: string[];
  allowedOutputFormats: AiActionOutputFormat[];
  placeholders: string[];
  defaultTemplate: Omit<
    AiActionTemplateDto,
    | "overridden"
    | "runnable"
    | "target"
    | "allowedIncludes"
    | "allowedOutputFormats"
    | "placeholders"
    | "defaultTemplate"
  >;
}

export interface AiActionTemplate extends AiActionTemplateFields {
  actionKey: AiActionKey;
  surface: string;
  version: number;
  source: AiActionTemplateSource;
  updatedAt: string | null;
  isDefault: boolean;
  defaults: AiActionTemplateFields | null;
  runnable: boolean;
  target: AiActionTarget["kind"] | null;
  allowedIncludes: string[];
  allowedOutputFormats: AiActionOutputFormat[];
  placeholders: string[];
}

export type UpdateAiActionTemplateRequest = Partial<AiActionTemplateFields>;

export type SaveAiActionTemplateRequest = UpdateAiActionTemplateRequest & {
  expectedVersion?: number;
};

export interface AiActionTemplatePreviewRequest {
  template?: UpdateAiActionTemplateRequest;
  targetId?: string;
  prompt?: string;
  selection?: string[];
  inputs?: { draft?: string };
}

export interface AiActionTemplatePreview {
  systemPrompt: string;
  userPrompt: string;
  input: unknown;
  errors: string[];
}

export interface AiWarmRequest {
  provider?: AiProviderId;
  model?: string;
  effort?: string | null;
}

export interface AiWarmResponse {
  warming: AiProviderId[];
  throttled: boolean;
}

export interface AiReviewFinding {
  severity?: string;
  title?: string;
  message?: string;
  target?: string;
  fix?: string;
}

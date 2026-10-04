import { buildUrl, readErrorMessage, reportUnauthorized } from "./httpClient";
import { actorHeaders } from "./actorIdentity";
import { AnnotationApiError } from "../types/annotation.types";
import type {
  AiActionEvent,
  AiActionEventType,
  AiActionKey,
  AiActionRunRequest,
  AiWarmRequest,
} from "../types/ai.types";

export class AiActionRequestError extends AnnotationApiError {
  readonly code: string | null;

  constructor(message: string, status: number, body: string | null, code: string | null) {
    super(message, status, body);
    this.name = "AiActionRequestError";
    this.code = code;
  }
}

export interface SseFrame {
  event: string;
  data: string;
  id?: string;
}

export interface SseParser {
  push: (chunk: string) => void;
  flush: () => void;
}

export function createSseParser(onFrame: (frame: SseFrame) => void): SseParser {
  let buffer = "";
  let event = "";
  let data: string[] = [];
  let hasData = false;
  let id: string | undefined;

  const dispatch = () => {
    if (hasData) {
      onFrame({ event: event || "message", data: data.join("\n"), ...(id ? { id } : {}) });
    }
    event = "";
    data = [];
    hasData = false;
    id = undefined;
  };

  const processLine = (line: string) => {
    if (line === "") {
      dispatch();
      return;
    }
    if (line.startsWith(":")) return;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") {
      data.push(value);
      hasData = true;
    } else if (field === "id") id = value;
  };

  let pendingCr = false;

  return {
    push(chunk) {
      let text = chunk;
      if (pendingCr) {
        text = `\r${text}`;
        pendingCr = false;
      }
      if (text.endsWith("\r")) {
        pendingCr = true;
        text = text.slice(0, -1);
      }
      buffer += text.indexOf("\r") === -1 ? text : text.replace(/\r\n?/g, "\n");
      let start = 0;
      for (;;) {
        const lf = buffer.indexOf("\n", start);
        if (lf === -1) break;
        processLine(buffer.slice(start, lf));
        start = lf + 1;
      }
      if (start > 0) buffer = buffer.slice(start);
    },
    flush() {
      pendingCr = false;
      if (buffer) {
        processLine(buffer);
        buffer = "";
      }
      dispatch();
    },
  };
}

const ACTION_EVENT_TYPES: ReadonlySet<AiActionEventType> = new Set<AiActionEventType>([
  "run.started",
  "step",
  "delta",
  "reasoning",
  "progress",
  "result",
  "usage",
  "error",
  "done",
]);

export function toAiActionEvent(frame: SseFrame): AiActionEvent | null {
  let payload: unknown;
  try {
    payload = JSON.parse(frame.data);
  } catch {
    return null;
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const type = (
    frame.event && frame.event !== "message" ? frame.event : record.type
  ) as AiActionEventType;
  if (!ACTION_EVENT_TYPES.has(type)) return null;
  return { ...record, type } as AiActionEvent;
}

function errorCode(text: string): string | null {
  try {
    const parsed = JSON.parse(text) as { code?: unknown; details?: { code?: unknown } };
    if (typeof parsed.code === "string" && parsed.code) return parsed.code;
    const nested = parsed.details?.code;
    return typeof nested === "string" && nested ? nested : null;
  } catch {
    return null;
  }
}

const MAX_SELECTION = 2000;

export function toRunActionBody(body: AiActionRunRequest): AiActionRunRequest {
  const out: AiActionRunRequest = {};
  if (body.newChat === true) out.newChat = true;
  else if (body.sessionId) out.sessionId = body.sessionId;
  if (body.targetId) out.targetId = body.targetId;
  if (body.prompt?.trim()) out.prompt = body.prompt;
  const selection = (body.selection ?? []).filter(
    (item) => typeof item === "string" && item.length > 0,
  );
  if (selection.length > 0) out.selection = [...new Set(selection)].slice(0, MAX_SELECTION);
  if (typeof body.inputs?.draft === "string") out.inputs = { draft: body.inputs.draft };
  if (body.provider) out.provider = body.provider;
  if (body.model?.trim()) out.model = body.model;
  if (body.effort !== undefined && body.effort !== "") out.effort = body.effort;
  if (body.template) out.template = body.template;
  if (body.fresh === true) out.fresh = true;
  const mentions = (body.mentions ?? [])
    .filter((item) => item && item.id && item.kind)
    .slice(0, 20);
  if (mentions.length > 0) {
    out.mentions = mentions.map(({ kind, id, label }) => ({ kind, id, label: label ?? "" }));
  }
  return out;
}

export const AI_ACTION_IDLE_TIMEOUT_MS = 60_000;

export interface RunAiActionOptions {
  apiBaseUrl: string;
  authToken: string | undefined;
  projectId: string;
  actionKey: AiActionKey;
  body: AiActionRunRequest;
  signal?: AbortSignal;
  idleTimeoutMs?: number;
  onEvent: (event: AiActionEvent) => void;
}

function streamInterrupted(message: string): AiActionRequestError {
  return new AiActionRequestError(message, 503, null, "stream_interrupted");
}

export async function runAiAction({
  apiBaseUrl,
  authToken,
  projectId,
  actionKey,
  body,
  signal,
  idleTimeoutMs = AI_ACTION_IDLE_TIMEOUT_MS,
  onEvent,
}: RunAiActionOptions): Promise<void> {
  const url = buildUrl(apiBaseUrl, `/ai/actions/${encodeURIComponent(actionKey)}/run`, {
    projectId,
  });
  const inner = new AbortController();
  const relayAbort = () => inner.abort();
  if (signal?.aborted) inner.abort();
  else signal?.addEventListener("abort", relayAbort, { once: true });
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let idledOut = false;
  const touch = () => {
    if (idleTimer) clearTimeout(idleTimer);
    if (idleTimeoutMs <= 0) return;
    idleTimer = setTimeout(() => {
      idledOut = true;
      inner.abort();
    }, idleTimeoutMs);
  };
  const clearIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
  };

  let sawTerminal = false;
  try {
    touch();
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "text/event-stream",
          "Content-Type": "application/json",
          ...actorHeaders(authToken),
        },
        body: JSON.stringify(toRunActionBody(body)),
        signal: inner.signal,
      });
    } catch (err) {
      if (idledOut) throw streamInterrupted("The AI action timed out waiting for a response");
      throw err;
    }

    if (!response.ok) {
      reportUnauthorized(response.status, authToken);
      const { message, text } = await readErrorMessage(
        response,
        `AI action failed (${response.status})`,
      );
      throw new AiActionRequestError(message, response.status, text || null, errorCode(text));
    }

    const parser = createSseParser((frame) => {
      const event = toAiActionEvent(frame);
      if (!event) return;
      if (event.type === "done" || event.type === "result") sawTerminal = true;
      onEvent(event);
    });

    if (!response.body) {
      parser.push(await response.text());
      parser.flush();
    } else {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          touch();
          parser.push(decoder.decode(value, { stream: true }));
        }
        parser.push(decoder.decode());
        parser.flush();
      } catch (err) {
        if (idledOut) throw streamInterrupted("The AI action stopped responding");
        throw err;
      } finally {
        reader.releaseLock?.();
      }
    }
    if (!sawTerminal && !inner.signal.aborted) {
      throw streamInterrupted("The AI response ended before it finished");
    }
  } finally {
    clearIdle();
    signal?.removeEventListener("abort", relayAbort);
  }
}

const WARM_INTERVAL_MS = 45_000;
const lastWarm = new Map<string, number>();

export function toWarmBody(route: AiWarmRequest | null | undefined): AiWarmRequest {
  const out: AiWarmRequest = {};
  if (!route) return out;
  if (route.provider) out.provider = route.provider;
  if (route.model?.trim()) out.model = route.model;
  if (route.effort !== undefined && route.effort !== "") out.effort = route.effort;
  const keys = [...new Set(route.actionKeys ?? [])].filter(Boolean).sort().slice(0, 6);
  if (keys.length > 0) out.actionKeys = keys;
  return out;
}

function warmKey(projectId: string, body: AiWarmRequest): string {
  return [
    projectId,
    body.provider ?? "",
    body.model ?? "",
    body.effort ?? "",
    (body.actionKeys ?? []).join(","),
  ].join("\u0000");
}

export function warmAi(
  apiBaseUrl: string,
  authToken: string | undefined,
  projectId: string,
  route?: AiWarmRequest | null,
  now: number = Date.now(),
): void {
  if (!projectId) return;
  const body = toWarmBody(route);
  const key = warmKey(projectId, body);
  const last = lastWarm.get(key);
  if (last !== undefined && now - last < WARM_INTERVAL_MS) return;
  lastWarm.set(key, now);
  try {
    void fetch(buildUrl(apiBaseUrl, "/ai/warm", { projectId }), {
      method: "POST",
      keepalive: true,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...actorHeaders(authToken),
      },
      body: JSON.stringify(body),
    }).catch(() => undefined);
  } catch {}
}

export function resetAiWarmThrottle(): void {
  lastWarm.clear();
}

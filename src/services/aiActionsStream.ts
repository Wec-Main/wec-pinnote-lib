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

  return {
    push(chunk) {
      buffer += chunk;
      let start = 0;
      for (;;) {
        const lf = buffer.indexOf("\n", start);
        const cr = buffer.indexOf("\r", start);
        let end: number;
        if (lf === -1 && cr === -1) break;
        if (cr !== -1 && (lf === -1 || cr < lf)) {
          if (cr === buffer.length - 1) break;
          end = cr;
          processLine(buffer.slice(start, end));
          start = buffer[cr + 1] === "\n" ? cr + 2 : cr + 1;
        } else {
          end = lf as number;
          processLine(buffer.slice(start, end));
          start = end + 1;
        }
      }
      buffer = buffer.slice(start);
    },
    flush() {
      if (buffer) {
        processLine(buffer.replace(/\r$/, ""));
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
  const mentions = (body.mentions ?? []).filter((item) => item && item.id && item.kind).slice(0, 20);
  if (mentions.length > 0) {
    out.mentions = mentions.map(({ kind, id, label }) => ({ kind, id, label: label ?? "" }));
  }
  return out;
}

export interface RunAiActionOptions {
  apiBaseUrl: string;
  authToken: string | undefined;
  projectId: string;
  actionKey: AiActionKey;
  body: AiActionRunRequest;
  signal?: AbortSignal;
  onEvent: (event: AiActionEvent) => void;
}

export async function runAiAction({
  apiBaseUrl,
  authToken,
  projectId,
  actionKey,
  body,
  signal,
  onEvent,
}: RunAiActionOptions): Promise<void> {
  const url = buildUrl(apiBaseUrl, `/ai/actions/${encodeURIComponent(actionKey)}/run`, {
    projectId,
  });
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      ...actorHeaders(authToken),
    },
    body: JSON.stringify(toRunActionBody(body)),
    signal,
  });

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
    if (event) onEvent(event);
  });

  if (!response.body) {
    parser.push(await response.text());
    parser.flush();
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.push(decoder.decode(value, { stream: true }));
    }
    parser.push(decoder.decode());
    parser.flush();
  } finally {
    reader.releaseLock?.();
  }
}

const WARM_INTERVAL_MS = 60_000;
const lastWarm = new Map<string, number>();

export function toWarmBody(route: AiWarmRequest | null | undefined): AiWarmRequest {
  const out: AiWarmRequest = {};
  if (!route) return out;
  if (route.provider) out.provider = route.provider;
  if (route.model?.trim()) out.model = route.model;
  if (route.effort !== undefined && route.effort !== "") out.effort = route.effort;
  return out;
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
  const key = `${projectId}\u0000${body.provider ?? ""}`;
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

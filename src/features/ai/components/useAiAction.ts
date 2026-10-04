import { useCallback, useEffect, useReducer, useRef } from "react";
import { useOptionalAiRuntime } from "../AiRuntimeContext";
import {
  AiActionRequestError,
  runAiAction,
  warmAi,
} from "../../../services/aiActionsStreamService";
import type {
  AiActionError,
  AiActionEvent,
  AiActionKey,
  AiActionRunRequest,
  AiActionRunState,
  AiActionStep,
  AiWarmRequest,
} from "../../../types/ai.types";

export const IDLE_AI_ACTION: AiActionRunState = {
  status: "idle",
  runId: null,
  actionKey: null,
  provider: null,
  model: null,
  steps: [],
  text: "",
  reasoning: "",
  progress: 0,
  partialOps: [],
  result: null,
  usage: null,
  error: null,
  aiSessionId: null,
  startedAt: null,
  finishedAt: null,
};

export type AiActionReducerAction =
  | { type: "start"; actionKey: AiActionKey; at: number }
  | { type: "event"; event: AiActionEvent; at: number }
  | { type: "append"; text: string; reasoning: string }
  | { type: "batch"; events: AiActionEvent[]; text: string; reasoning: string; at: number }
  | { type: "settle"; at: number }
  | { type: "fail"; error: AiActionError; at: number }
  | { type: "cancel"; at: number }
  | { type: "reset" };

const isRunning = (state: AiActionRunState) => state.status === "running";

function upsertStep(steps: AiActionStep[], step: AiActionStep): AiActionStep[] {
  const index = steps.findIndex((item) => item.id === step.id);
  if (index === -1) return [...steps, step];
  const next = steps.slice();
  next[index] = { ...steps[index], ...step };
  return next;
}

function closeSteps(steps: AiActionStep[], failed: boolean): AiActionStep[] {
  return steps.some((step) => step.status === "running")
    ? steps.map((step) =>
        step.status === "running" ? { ...step, status: failed ? "failed" : "done" } : step,
      )
    : steps;
}

function applyEvent(state: AiActionRunState, event: AiActionEvent, at: number): AiActionRunState {
  switch (event.type) {
    case "run.started":
      return {
        ...state,
        runId: event.runId,
        actionKey: event.actionKey,
        provider: event.provider,
        model: event.model ?? state.model,
      };
    case "step": {
      const { type: _type, ...step } = event;
      return { ...state, steps: upsertStep(state.steps, step) };
    }
    case "delta":
      return { ...state, text: state.text + event.text };
    case "reasoning":
      return { ...state, reasoning: state.reasoning + event.text };
    case "progress":
      return {
        ...state,
        progress: event.ops,
        partialOps: Array.isArray(event.newOps)
          ? [...state.partialOps.slice(0, event.from ?? state.partialOps.length), ...event.newOps]
          : state.partialOps,
      };
    case "result": {
      const { type: _type, ...result } = event;
      return { ...state, result };
    }
    case "usage": {
      const { type: _type, ...usage } = event;
      return { ...state, usage };
    }
    case "error": {
      const { type: _type, ...error } = event;
      return { ...state, error };
    }
    case "done": {
      const status =
        event.status === "cancelled"
          ? "cancelled"
          : event.status === "failed" || state.error
            ? "error"
            : "done";
      return {
        ...state,
        status,
        error:
          status === "error" && !state.error
            ? { code: "run_failed", message: "The AI run failed.", retryable: true }
            : state.error,
        steps: closeSteps(state.steps, status !== "done"),
        aiSessionId: typeof event.aiSessionId === "string" ? event.aiSessionId : state.aiSessionId,
        finishedAt: at,
      };
    }
    default:
      return state;
  }
}

export function aiActionReducer(
  state: AiActionRunState,
  action: AiActionReducerAction,
): AiActionRunState {
  switch (action.type) {
    case "start":
      return {
        ...IDLE_AI_ACTION,
        status: "running",
        actionKey: action.actionKey,
        startedAt: action.at,
      };
    case "event":
      return isRunning(state) ? applyEvent(state, action.event, action.at) : state;
    case "append":
      return isRunning(state)
        ? {
            ...state,
            text: state.text + action.text,
            reasoning: state.reasoning + action.reasoning,
          }
        : state;
    case "batch": {
      if (!isRunning(state)) return state;
      let next = state;
      for (const event of action.events) next = applyEvent(next, event, action.at);
      return action.text || action.reasoning
        ? {
            ...next,
            text: next.text + action.text,
            reasoning: next.reasoning + action.reasoning,
          }
        : next;
    }
    case "settle":
      if (!isRunning(state)) return state;
      return {
        ...state,
        status: state.error ? "error" : "done",
        steps: closeSteps(state.steps, Boolean(state.error)),
        finishedAt: action.at,
      };
    case "fail":
      if (!isRunning(state)) return state;
      return {
        ...state,
        status: "error",
        error: action.error,
        steps: closeSteps(state.steps, true),
        finishedAt: action.at,
      };
    case "cancel":
      if (!isRunning(state)) return state;
      return {
        ...state,
        status: "cancelled",
        steps: closeSteps(state.steps, true),
        finishedAt: action.at,
      };
    case "reset":
      return IDLE_AI_ACTION;
    default:
      return state;
  }
}

function isAbortError(err: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" &&
      err instanceof DOMException &&
      err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

export function toAiActionError(err: unknown): AiActionError {
  if (err instanceof AiActionRequestError) {
    return {
      code: err.code ?? `http_${err.status}`,
      message: err.message,
      retryable: err.status === 408 || err.status === 429 || err.status >= 500,
    };
  }
  return {
    code: "network_error",
    message: err instanceof Error && err.message ? err.message : "Could not reach the server",
    retryable: true,
  };
}

type FrameHandle = { cancel: () => void };

function scheduleFrame(callback: () => void): FrameHandle {
  if (typeof requestAnimationFrame === "function") {
    const id = requestAnimationFrame(callback);
    return { cancel: () => cancelAnimationFrame(id) };
  }
  const id = setTimeout(callback, 16);
  return { cancel: () => clearTimeout(id) };
}

export interface AiLiveText {
  text: string;
  reasoning: string;
}

export interface AiLiveTextStore {
  get: () => AiLiveText;
  subscribe: (listener: () => void) => () => void;
}

const EMPTY_LIVE_TEXT: AiLiveText = { text: "", reasoning: "" };

class LiveTextStore implements AiLiveTextStore {
  private value: AiLiveText = EMPTY_LIVE_TEXT;
  private readonly listeners = new Set<() => void>();

  get = (): AiLiveText => this.value;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  append(text: string, reasoning: string): void {
    if (!text && !reasoning) return;
    this.value = { text: this.value.text + text, reasoning: this.value.reasoning + reasoning };
    for (const listener of [...this.listeners]) listener();
  }

  reset(): void {
    if (this.value === EMPTY_LIVE_TEXT) return;
    this.value = EMPTY_LIVE_TEXT;
    for (const listener of [...this.listeners]) listener();
  }
}

const FRAME_EVENTS: ReadonlySet<AiActionEvent["type"]> = new Set(["progress", "step"]);

export interface UseAiActionOptions {
  apiBaseUrl?: string;
  projectId?: string;
  getToken?: () => Promise<string | undefined> | string | undefined;
  liveText?: boolean;
}

export interface UseAiActionResult {
  state: AiActionRunState;
  live: AiLiveTextStore;
  run: (actionKey: AiActionKey, body?: AiActionRunRequest) => Promise<void>;
  stop: () => void;
  reset: () => void;
}

export function useAiAction(options: UseAiActionOptions = {}): UseAiActionResult {
  const runtime = useOptionalAiRuntime();
  const [state, dispatch] = useReducer(aiActionReducer, IDLE_AI_ACTION);
  const configRef = useRef({ runtime, options });
  configRef.current = { runtime, options };

  const controllerRef = useRef<AbortController | null>(null);
  const runSeqRef = useRef(0);
  const pendingRef = useRef<{ text: string; reasoning: string; events: AiActionEvent[] }>({
    text: "",
    reasoning: "",
    events: [],
  });
  const frameRef = useRef<FrameHandle | null>(null);
  const liveRef = useRef<LiveTextStore | null>(null);
  liveRef.current ??= new LiveTextStore();
  const live = liveRef.current;
  const committedRef = useRef({ text: 0, reasoning: 0 });
  const liveText = options.liveText === true;

  const flushPending = useCallback(
    (commit = true) => {
      frameRef.current?.cancel();
      frameRef.current = null;
      const { text, reasoning, events } = pendingRef.current;
      pendingRef.current = { text: "", reasoning: "", events: [] };
      let outText = text;
      let outReasoning = reasoning;
      if (liveText) {
        live.append(text, reasoning);
        const { text: full, reasoning: fullReasoning } = live.get();
        const committed = committedRef.current;
        outText = commit || committed.text === 0 ? full.slice(committed.text) : "";
        outReasoning =
          commit || committed.reasoning === 0 ? fullReasoning.slice(committed.reasoning) : "";
        committedRef.current = {
          text: committed.text + outText.length,
          reasoning: committed.reasoning + outReasoning.length,
        };
      }
      if (!outText && !outReasoning && events.length === 0) return;
      if (events.length === 0) {
        dispatch({ type: "append", text: outText, reasoning: outReasoning });
        return;
      }
      dispatch({
        type: "batch",
        events,
        text: outText,
        reasoning: outReasoning,
        at: Date.now(),
      });
    },
    [live, liveText],
  );

  const dropPending = useCallback(() => {
    frameRef.current?.cancel();
    frameRef.current = null;
    pendingRef.current = { text: "", reasoning: "", events: [] };
    committedRef.current = { text: 0, reasoning: 0 };
    live.reset();
  }, [live]);

  const stop = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    controllerRef.current = null;
    runSeqRef.current++;
    flushPending();
    controller.abort();
    dispatch({ type: "cancel", at: Date.now() });
  }, [flushPending]);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    runSeqRef.current++;
    dropPending();
    dispatch({ type: "reset" });
  }, [dropPending]);

  const run = useCallback(
    async (actionKey: AiActionKey, body: AiActionRunRequest = {}) => {
      controllerRef.current?.abort();
      dropPending();
      const controller = new AbortController();
      controllerRef.current = controller;
      const seq = ++runSeqRef.current;
      const current = () => runSeqRef.current === seq;
      dispatch({ type: "start", actionKey, at: Date.now() });

      const { runtime: rt, options: opts } = configRef.current;
      const apiBaseUrl = opts.apiBaseUrl ?? rt?.apiBaseUrl ?? "";
      const projectId = opts.projectId ?? rt?.projectId ?? "";
      const getToken = opts.getToken ?? rt?.getToken;

      const onEvent = (event: AiActionEvent) => {
        if (!current()) return;
        const pending = pendingRef.current;
        if (event.type === "delta" || event.type === "reasoning" || FRAME_EVENTS.has(event.type)) {
          if (event.type === "delta") pending.text += event.text;
          else if (event.type === "reasoning") pending.reasoning += event.text;
          else pending.events.push(event);
          frameRef.current ??= scheduleFrame(() => flushPending(false));
          return;
        }
        flushPending();
        dispatch({ type: "event", event, at: Date.now() });
      };

      try {
        const authToken = getToken ? await getToken() : undefined;
        if (!current()) return;
        await runAiAction({
          apiBaseUrl,
          authToken,
          projectId,
          actionKey,
          body,
          signal: controller.signal,
          onEvent,
        });
        if (!current()) return;
        flushPending();
        dispatch({ type: "settle", at: Date.now() });
      } catch (err) {
        if (!current() || isAbortError(err)) return;
        flushPending();
        dispatch({ type: "fail", error: toAiActionError(err), at: Date.now() });
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
      }
    },
    [dropPending, flushPending],
  );

  useEffect(
    () => () => {
      runSeqRef.current++;
      controllerRef.current?.abort();
      controllerRef.current = null;
      frameRef.current?.cancel();
      frameRef.current = null;
    },
    [],
  );

  return { state, live, run, stop, reset };
}

export function useWarmAi(): (
  projectId: string | null | undefined,
  route?: AiWarmRequest | null,
) => void {
  const runtime = useOptionalAiRuntime();
  const runtimeRef = useRef(runtime);
  runtimeRef.current = runtime;
  return useCallback((projectId, route) => {
    const rt = runtimeRef.current;
    const id = projectId ?? rt?.projectId;
    if (!rt || !rt.enabled || !id) return;
    void rt.getToken().then(
      (token) => warmAi(rt.apiBaseUrl, token, id, route),
      () => undefined,
    );
  }, []);
}

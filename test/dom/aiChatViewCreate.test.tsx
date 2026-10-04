import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiChatView } from "../../src/features/ai/components/AiChatView";
import { AiRuntimeContext } from "../../src/features/ai/AiRuntimeContext";
import { resetAiWarmThrottle } from "../../src/services/aiActionsStreamService";
import { clearResources } from "../../src/utils/resourceCache";
import {
  T0,
  aiMe,
  connector,
  fakeRuntime,
  flush,
  jsonResponse,
  press,
  typeInto,
} from "./aiTestUtils";

vi.mock("../../src/features/ai/components/useAiMentionCandidates", () => ({
  useAiMentionCandidates: () => ({ candidates: [], request: () => undefined }),
}));

vi.mock("../../src/features/ai/components/useAiCardActions", () => ({
  useAiCardActions: () => ({}),
}));

type Mode = "fast" | "old" | "plain";

let container: HTMLDivElement;
let root: Root;
let mode: Mode;
let fetchMock: ReturnType<typeof vi.fn>;

const session = {
  aiSessionId: "s-new",
  projectId: "p1",
  title: "",
  mode: "model",
  scopeKind: "project",
  scopeId: null,
  provider: "claude",
  model: "claude-model",
  effort: null,
  createdById: "u1",
  createdByName: null,
  nativeSessionOwnerId: null,
  lastMessageAt: T0,
  createdAt: T0,
  updatedAt: T0,
  archivedAt: null,
  activeTurn: null,
};

const turn = {
  aiTurnId: "t1",
  aiSessionId: "s-new",
  status: "queued",
  createdAt: T0,
};

function userMessage(text: string) {
  return {
    aiMessageId: "m1",
    aiSessionId: "s-new",
    aiTurnId: "t1",
    authorId: "u1",
    authorName: null,
    role: "user",
    content: { type: "text", text },
    createdAt: T0,
    updatedAt: T0,
  };
}

function detail(text: string | null) {
  return {
    session: { ...session, activeTurn: text ? turn : null },
    messages: text ? [userMessage(text)] : [],
    hasMoreMessages: false,
    opBatches: [],
    commentDrafts: [],
  };
}

function route(url: string) {
  return new URL(url).pathname.replace("/api/v1/pinnote", "");
}

function calls(method: string, path: string) {
  return fetchMock.mock.calls.filter(
    ([url, init]) =>
      route(String(url)) === path &&
      ((init as RequestInit | undefined)?.method ?? "GET") === method,
  );
}

function Harness() {
  const [aiSessionId, setAiSessionId] = useState<string | null>(null);
  return createElement(AiChatView, { aiSessionId, onSessionCreated: setAiSessionId });
}

beforeEach(() => {
  clearResources();
  resetAiWarmThrottle();
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const path = route(url);
    const method = init?.method ?? "GET";
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    if (path === "/ai/sessions" && method === "POST") {
      const message = body.message as { text: string } | undefined;
      if (mode === "old" && message) {
        return jsonResponse(
          {
            error: "Validation failed",
            details: { formErrors: ["Unrecognized key(s) in object: 'message'"] },
          },
          400,
        );
      }
      if (mode === "fast" && message) return jsonResponse(detail(message.text), 201);
      return jsonResponse(session, 201);
    }
    if (path === "/ai/sessions/s-new/messages" && method === "POST") {
      return jsonResponse({ message: userMessage(String(body.text)), turn }, 202);
    }
    if (path === "/ai/sessions/s-new") return jsonResponse(detail("hello"));
    if (path === "/ai/sessions") return jsonResponse([]);
    return jsonResponse({});
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
  window.localStorage.clear();
  window.sessionStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const runtime = fakeRuntime({ me: aiMe({ connectors: [connector("claude")] }) });
  act(() =>
    root.render(
      createElement(AiRuntimeContext.Provider, { value: runtime.value }, createElement(Harness)),
    ),
  );
});

afterEach(async () => {
  act(() => root.unmount());
  await flush();
  container.remove();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

async function sendHello() {
  await flush();
  const field = container.querySelector<HTMLTextAreaElement>("textarea")!;
  typeInto(field, "hello");
  press(field, "Enter");
  await flush(30);
}

describe("AiChatView new chat", () => {
  it("creates the session with the first message and skips the send and detail requests", async () => {
    mode = "fast";
    await sendHello();
    const creates = calls("POST", "/ai/sessions");
    expect(creates).toHaveLength(1);
    const body = JSON.parse(String((creates[0]![1] as RequestInit).body)) as {
      message: { text: string; clientMessageId: string; mode?: string };
    };
    expect(body.message.text).toBe("hello");
    expect(body.message.clientMessageId).toBeTruthy();
    expect(body.message.mode).toBeUndefined();
    expect(calls("POST", "/ai/sessions/s-new/messages")).toHaveLength(0);
    expect(calls("GET", "/ai/sessions/s-new")).toHaveLength(0);
    expect(container.textContent).toContain("hello");
  });

  it("falls back to create, send and load when the server rejects the message field", async () => {
    mode = "old";
    await sendHello();
    const creates = calls("POST", "/ai/sessions");
    expect(creates).toHaveLength(2);
    expect(JSON.parse(String((creates[1]![1] as RequestInit).body))).not.toHaveProperty("message");
    const sends = calls("POST", "/ai/sessions/s-new/messages");
    expect(sends).toHaveLength(1);
    const sent = JSON.parse(String((sends[0]![1] as RequestInit).body)) as {
      clientMessageId: string;
    };
    const first = JSON.parse(String((creates[0]![1] as RequestInit).body)) as {
      message: { clientMessageId: string };
    };
    expect(sent.clientMessageId).toBe(first.message.clientMessageId);
    expect(calls("GET", "/ai/sessions/s-new")).toHaveLength(1);
  });

  it("sends separately when the create response does not include the message", async () => {
    mode = "plain";
    await sendHello();
    expect(calls("POST", "/ai/sessions")).toHaveLength(1);
    expect(calls("POST", "/ai/sessions/s-new/messages")).toHaveLength(1);
    expect(calls("GET", "/ai/sessions/s-new")).toHaveLength(1);
  });
});

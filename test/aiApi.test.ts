import { afterEach, describe, expect, it, vi } from "vitest";
import * as ai from "../src/services/aiService";

const BASE = "https://api.example.com";
const PREFIX = `${BASE}/api/v1/pinnote`;

function stubFetch(status: number, body: unknown = {}) {
  const fetchMock = vi
    .fn()
    .mockImplementation(
      async () => new Response(status === 204 ? null : JSON.stringify(body), { status }),
    );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function lastCall(fetchMock: ReturnType<typeof stubFetch>) {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return {
    url,
    method: init.method ?? "GET",
    body: init.body ? JSON.parse(String(init.body)) : undefined,
    init,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("op batch and template requests", () => {
  it("fetches a single op batch", async () => {
    const fetchMock = stubFetch(200, { aiOpBatchId: "b/1", status: "applying" });
    const batch = await ai.fetchAiOpBatch(BASE, "t", "b/1");
    const call = lastCall(fetchMock);
    expect(call.url).toBe(`${PREFIX}/ai/op-batches/b%2F1`);
    expect(call.method).toBe("GET");
    expect(batch.status).toBe("applying");
  });

  it("sends expectedVersion when saving a template", async () => {
    const fetchMock = stubFetch(200, { actionKey: "comment.improve", version: 4 });
    await ai.saveAiActionTemplate(BASE, "t", "p1", "comment.improve", {
      name: "x",
      expectedVersion: 3,
    });
    const call = lastCall(fetchMock);
    expect(call.method).toBe("PUT");
    expect(call.body).toEqual({ name: "x", expectedVersion: 3 });
  });
});

describe("aiApi routes", () => {
  const cases: [string, () => Promise<unknown>, string, string, unknown?, number?][] = [
    ["me", () => ai.fetchAiMe(BASE, "t", "p1"), "GET", "/ai/me?projectId=p1"],
    [
      "connectors",
      () => ai.fetchAiConnectors(BASE, "t", "p1"),
      "GET",
      "/ai/connectors?projectId=p1",
    ],
    [
      "connectors refresh",
      () => ai.fetchAiConnectors(BASE, "t", "p1", true),
      "GET",
      "/ai/connectors?projectId=p1&refresh=1",
    ],
    [
      "login",
      () => ai.startConnectorLogin(BASE, "t", "p1", "claude"),
      "POST",
      "/ai/connectors/claude/login?projectId=p1",
      {},
    ],
    [
      "login status",
      () => ai.getConnectorLoginStatus(BASE, "t", "p1", "codex", "l/1"),
      "GET",
      "/ai/connectors/codex/login/l%2F1?projectId=p1",
    ],
    [
      "login code",
      () => ai.submitConnectorLoginCode(BASE, "t", "p1", "claude", "l1", "abc#s"),
      "POST",
      "/ai/connectors/claude/login/l1/code?projectId=p1",
      { code: "abc#s" },
    ],
    [
      "login cancel",
      () => ai.cancelConnectorLogin(BASE, "t", "p1", "codex", "l1"),
      "POST",
      "/ai/connectors/codex/login/l1/cancel?projectId=p1",
      undefined,
      204,
    ],
    [
      "api key",
      () => ai.saveConnectorApiKey(BASE, "t", "p1", "codex", "sk-1"),
      "POST",
      "/ai/connectors/codex/api-key?projectId=p1",
      { apiKey: "sk-1" },
    ],
    [
      "logout",
      () => ai.logoutConnector(BASE, "t", "p1", "claude"),
      "POST",
      "/ai/connectors/claude/logout?projectId=p1",
    ],
    [
      "sessions",
      () =>
        ai.listAiSessions(BASE, "t", {
          projectId: "p1",
          scopeKind: "flow",
          scopeId: "f1",
          mine: true,
          limit: 50,
        }),
      "GET",
      "/ai/sessions?projectId=p1&scopeKind=flow&scopeId=f1&mine=true&limit=50",
    ],
    [
      "create session",
      () =>
        ai.createAiSession(BASE, "t", {
          projectId: "p1",
          mode: "model",
          scopeKind: "project",
          provider: "claude",
          model: "m",
        }),
      "POST",
      "/ai/sessions",
      { projectId: "p1", scopeKind: "project", provider: "claude", model: "m" },
    ],
    ["session", () => ai.fetchAiSession(BASE, "t", "s1"), "GET", "/ai/sessions/s1"],
    [
      "messages",
      () => ai.fetchAiSessionMessages(BASE, "t", "s1", { before: "m9", limit: 100 }),
      "GET",
      "/ai/sessions/s1/messages?before=m9&limit=100",
    ],
    [
      "update session",
      () => ai.updateAiSession(BASE, "t", "s1", { title: "x" }),
      "PATCH",
      "/ai/sessions/s1",
      { title: "x" },
    ],
    [
      "send",
      () => ai.sendAiMessage(BASE, "t", "s1", { text: "hi" }),
      "POST",
      "/ai/sessions/s1/messages",
      { text: "hi" },
    ],
    [
      "interrupt",
      () => ai.interruptAiSession(BASE, "t", "s1"),
      "POST",
      "/ai/sessions/s1/interrupt",
    ],
    [
      "op batch",
      () => ai.updateAiOpBatch(BASE, "t", "ob1", { status: "saved", savedRevision: 4 }),
      "PATCH",
      "/ai/op-batches/ob1",
      { status: "saved", savedRevision: 4 },
    ],
    [
      "comment draft",
      () => ai.updateAiCommentDraft(BASE, "t", "cd1", { status: "posted", postedCommentId: "c1" }),
      "PATCH",
      "/ai/comment-drafts/cd1",
      { status: "posted", postedCommentId: "c1" },
    ],
    [
      "stream ticket",
      () => ai.fetchAiStreamTicket(BASE, "t", "p1"),
      "POST",
      "/ai/stream/ticket?projectId=p1",
    ],
  ];

  for (const [name, call, method, path, body, status] of cases) {
    it(`${name}: ${method} ${path}`, async () => {
      const fetchMock = stubFetch(status ?? 200, { ok: true });
      await call();
      const last = lastCall(fetchMock);
      expect(last.url).toBe(`${PREFIX}${path}`);
      expect(last.method).toBe(method);
      expect(last.body).toEqual(body);
      expect(last.init.headers).toMatchObject({ Authorization: "Bearer t" });
    });
  }

  it("surfaces the server error message", async () => {
    stubFetch(403, { error: "Claude sign-in is turned off" });
    await expect(ai.startConnectorLogin(BASE, "t", "p1", "claude")).rejects.toMatchObject({
      status: 403,
      message: "Claude sign-in is turned off",
    });
  });
});

describe("createAiSessionWithMessage", () => {
  const input = {
    projectId: "p1",
    mode: "model" as const,
    scopeKind: "project" as const,
    provider: "claude" as const,
    model: "m",
    message: { text: "hi", mode: "model" as const, clientMessageId: "c1" },
  };

  it("returns the sent message from a session detail response", async () => {
    const message = { aiMessageId: "m1", aiTurnId: "t1", role: "user" };
    const turn = { aiTurnId: "t1", status: "queued" };
    const fetchMock = stubFetch(201, {
      session: { aiSessionId: "s1", activeTurn: turn },
      messages: [message],
      hasMoreMessages: false,
      opBatches: [],
      commentDrafts: [],
    });
    const result = await ai.createAiSessionWithMessage(BASE, "t", input);
    expect(lastCall(fetchMock).body.message).toEqual({ text: "hi", clientMessageId: "c1" });
    expect(result.session.aiSessionId).toBe("s1");
    expect(result.sent).toEqual({ message, turn });
    expect(result.detail?.messages).toEqual([message]);
  });

  it("reports nothing sent for a plain session response", async () => {
    stubFetch(201, { aiSessionId: "s1" });
    const result = await ai.createAiSessionWithMessage(BASE, "t", input);
    expect(result).toEqual({ session: { aiSessionId: "s1" }, detail: null, sent: null });
  });

  it("rethrows validation errors unrelated to the message field", async () => {
    const fetchMock = stubFetch(400, { error: "Validation failed", details: { model: ["bad"] } });
    await expect(ai.createAiSessionWithMessage(BASE, "t", input)).rejects.toMatchObject({
      status: 400,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

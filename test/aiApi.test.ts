import { afterEach, describe, expect, it, vi } from "vitest";
import * as ai from "../src/services/aiApi";

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

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConnectDialog,
  type ConnectDialogProps,
} from "../../src/features/ai/components/ConnectDialog";
import { AiRuntimeContext } from "../../src/features/ai/AiRuntimeContext";
import type { AiConnector, AiLoginStart, AiMe, AiProviderId } from "../../src/types/ai.types";
import {
  aiMe,
  buttonByText,
  click,
  connector,
  fakeRuntime,
  flush,
  jsonResponse,
  press,
  typeInto,
  type FakeRuntime,
} from "./aiTestUtils";

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;
let mergeConnectors: ReturnType<typeof vi.fn>;
let onConnected: ReturnType<typeof vi.fn>;
let onClose: ReturnType<typeof vi.fn>;
let openSpy: ReturnType<typeof vi.spyOn>;
let runtime: FakeRuntime;

const inFuture = (ms: number) => new Date(Date.now() + ms).toISOString();

interface Call {
  method: string;
  path: string;
  scope: string | null;
  body: unknown;
}

function allCalls(): Call[] {
  return fetchMock.mock.calls.map(([url, init]) => {
    const parsed = new URL(String(url));
    const request = init as RequestInit | undefined;
    return {
      method: request?.method ?? "GET",
      path: parsed.pathname.replace("/api/v1/pinnote", ""),
      scope: parsed.searchParams.get("scope"),
      body: request?.body ? JSON.parse(String(request.body)) : undefined,
    };
  });
}

const calls = () => allCalls().filter((call) => !call.path.endsWith("/status"));

const cancelCalls = () => calls().filter((call) => call.path.endsWith("/cancel"));

type Handler = (body: unknown, url: URL) => Response;

function routes(handlers: Record<string, Handler>) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const parsed = new URL(url);
    const path = parsed.pathname.replace("/api/v1/pinnote", "");
    const key = `${init?.method ?? "GET"} ${path}`;
    const handler = handlers[key] ?? (key.endsWith("/cancel") ? () => noContent() : undefined);
    if (!handler) throw new Error(`unexpected ${key}`);
    return handler(init?.body ? JSON.parse(String(init.body)) : undefined, parsed);
  });
}

const noContent = () => new Response(null, { status: 204 });

function claudeLogin(overrides: Partial<AiLoginStart> = {}): AiLoginStart {
  return {
    loginId: "L1",
    provider: "claude",
    method: "link_paste",
    url: "https://claude.ai/oauth/authorize?x=1",
    userCode: null,
    needsCode: true,
    expiresAt: inFuture(600_000),
    ...overrides,
  };
}

function codexLogin(overrides: Partial<AiLoginStart> = {}): AiLoginStart {
  return {
    loginId: "D1",
    provider: "codex",
    method: "device_code",
    url: "https://auth.openai.com/codex/device",
    userCode: "ABCD-1234",
    needsCode: false,
    expiresAt: inFuture(900_000),
    ...overrides,
  };
}

function render(
  provider: AiProviderId,
  props: Partial<ConnectDialogProps> = {},
  me: Partial<AiMe> = {},
) {
  runtime = fakeRuntime({ me: aiMe(me), mergeConnectors });
  act(() =>
    root.render(
      createElement(
        AiRuntimeContext.Provider,
        { value: runtime.value },
        createElement(ConnectDialog, { provider, onClose, onConnected, ...props }),
      ),
    ),
  );
}

const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]')!;
const button = (text: string | RegExp) => buttonByText(document.body, text);
const codeInput = () =>
  document.body.querySelector<HTMLInputElement>('input[placeholder="Paste the code here"]')!;
const keyInput = () => document.body.querySelector<HTMLInputElement>('input[placeholder^="sk-"]')!;
const alertBox = () => document.body.querySelector('[role="alert"]');
const loginEvent = (
  state: "succeeded" | "failed" | "verifying" | "pending",
  extra: { loginId?: string; connector?: AiConnector | null } = {},
) => ({
  type: "ai_connector_login.updated" as const,
  loginId: extra.loginId ?? "D1",
  provider: "codex" as const,
  state,
  error: null,
  connector: extra.connector ?? null,
});

function stubClipboard(text: string | null) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value:
      text === null
        ? undefined
        : { readText: vi.fn(async () => text), writeText: vi.fn(async () => undefined) },
  });
}

beforeEach(() => {
  fetchMock = vi.fn();
  mergeConnectors = vi.fn();
  onConnected = vi.fn();
  onClose = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
  openSpy = vi.spyOn(window, "open").mockReturnValue(null);
  stubClipboard(null);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  act(() => root.unmount());
  await flush();
  container.remove();
  document.body.innerHTML = "";
  openSpy.mockRestore();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("ConnectDialog — Claude subscription", () => {
  it("walks the 3 steps: new-tab sign-in, copy the code, paste it and Connect", async () => {
    const connected = connector("claude", {
      account: { email: "kavi@example.com", plan: "Max", organization: null },
    });
    routes({
      "POST /ai/connectors/claude/login": () => jsonResponse(claudeLogin()),
      "POST /ai/connectors/claude/login/L1/code": () =>
        jsonResponse({
          loginId: "L1",
          provider: "claude",
          state: "succeeded",
          error: null,
          connector: connected,
        }),
    });
    render("claude");
    expect(dialog().textContent).toContain("Connect Claude");
    expect(dialog().textContent).toContain("Only you will use this connection");
    const subscription = button(/Claude subscription/)!;
    expect(subscription.getAttribute("aria-checked")).toBe("true");
    expect(subscription.textContent).toContain("Use your Pro or Max plan");
    expect(button(/Pay as you go/)?.getAttribute("aria-checked")).toBe("false");
    expect(button("Everyone")).toBeNull();

    await flush();
    expect(calls()[0]).toMatchObject({ method: "POST", path: "/ai/connectors/claude/login" });
    expect(calls()[0]?.scope).toBeNull();
    expect(openSpy).not.toHaveBeenCalled();
    const steps = dialog().querySelectorAll(".wpn-ai-step");
    expect(
      [...steps].map((step) => step.querySelector(".wpn-ai-step__title")?.textContent),
    ).toEqual(["Open Claude sign-in", "Copy the code Claude shows you", "Paste it here"]);
    expect(steps[0]?.getAttribute("aria-current")).toBe("step");
    expect(dialog().textContent).toContain("Includes everything after #");
    expect(dialog().textContent).toMatch(/Link expires in \d+:\d\d/);
    expect(codeInput()).not.toBeNull();
    expect(codeInput().className).toContain("wpn-ai-connect__input--mono");

    click(button("Open Claude sign-in"));
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith("https://claude.ai/oauth/authorize?x=1", "_blank");
    expect(dialog().textContent).toContain("Opened in a new tab");
    expect(button("Open again")).not.toBeNull();
    expect(
      dialog().querySelectorAll(".wpn-ai-step")[0]?.classList.contains("wpn-ai-step--done"),
    ).toBe(true);

    const connect = button("Connect")!;
    expect(connect.getAttribute("aria-disabled")).toBe("true");
    typeInto(codeInput(), " abc123#state456 ");
    click(button("Connect"));
    await flush();
    expect(calls().find((call) => call.path.endsWith("/code"))?.body).toEqual({
      code: "abc123#state456",
    });
    expect(dialog().textContent).toContain("Claude is connected");
    expect(dialog().textContent).toContain("Signed in as kavi@example.com · Max");
    const footerButtons = dialog().querySelectorAll(".wpn-modal-shell__footer button");
    expect([...footerButtons].map((b) => b.textContent)).toEqual(["Done"]);
    expect(mergeConnectors).toHaveBeenCalledWith([connected]);
    expect(onConnected).toHaveBeenCalledWith(connected);
    expect(JSON.parse(window.localStorage.getItem("wpn-ai:defaults") ?? "null")).toEqual({
      provider: "claude",
      model: null,
      effort: null,
    });
    act(() => root.unmount());
    root = createRoot(container);
    await flush();
    expect(cancelCalls()).toEqual([]);
  });

  it("never reads the clipboard or submits by itself on focus, visibility or paste", async () => {
    stubClipboard("abc123#state456");
    routes({ "POST /ai/connectors/claude/login": () => jsonResponse(claudeLogin()) });
    render("claude");
    await flush();
    const event = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(event, "clipboardData", {
      value: { getData: () => "pasted#code" },
    });
    act(() => {
      window.dispatchEvent(new Event("focus"));
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      dialog().dispatchEvent(event);
    });
    await flush();
    Reflect.deleteProperty(document, "visibilityState");
    expect(navigator.clipboard.readText).not.toHaveBeenCalled();
    expect(calls().some((call) => call.path.endsWith("/code"))).toBe(false);
    expect(codeInput().value).toBe("");
    expect(button("Paste & connect")).toBeNull();
  });

  it("fills the code from the clipboard only when Paste is clicked, then Connect submits", async () => {
    stubClipboard("  gesture#code-1 \n");
    routes({
      "POST /ai/connectors/claude/login": () => jsonResponse(claudeLogin()),
      "POST /ai/connectors/claude/login/L1/code": () =>
        jsonResponse({
          loginId: "L1",
          provider: "claude",
          state: "succeeded",
          error: null,
          connector: connector("claude"),
        }),
    });
    render("claude");
    await flush();
    click(button("Paste"));
    await flush();
    expect(navigator.clipboard.readText).toHaveBeenCalledTimes(1);
    expect(codeInput().value).toBe("gesture#code-1");
    expect(calls().some((call) => call.path.endsWith("/code"))).toBe(false);
    click(button("Connect"));
    await flush();
    expect(calls().find((call) => call.path.endsWith("/code"))?.body).toEqual({
      code: "gesture#code-1",
    });
    expect(dialog().textContent).toContain("Claude is connected");
  });

  it("ignores a denied clipboard read on Paste", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: vi.fn(async () => {
          throw new DOMException("denied", "NotAllowedError");
        }),
        writeText: vi.fn(async () => undefined),
      },
    });
    routes({ "POST /ai/connectors/claude/login": () => jsonResponse(claudeLogin()) });
    render("claude");
    await flush();
    click(button("Paste"));
    await flush();
    expect(codeInput().value).toBe("");
    expect(alertBox()).toBeNull();
  });

  it("submits the code with Enter and shows that it is connecting", async () => {
    let resolveCode: (response: Response) => void = () => undefined;
    routes({
      "POST /ai/connectors/claude/login": () => jsonResponse(claudeLogin()),
    });
    render("claude");
    await flush();
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => (resolveCode = resolve)),
    );
    typeInto(codeInput(), "abc#def");
    act(() => {
      codeInput().form!.requestSubmit();
    });
    await flush();
    expect(dialog().textContent).toContain("Connecting…");
    expect(button("Connecting…")).not.toBeNull();
    resolveCode(
      jsonResponse({
        loginId: "L1",
        provider: "claude",
        state: "succeeded",
        error: null,
        connector: connector("claude"),
      }),
    );
    await flush();
    expect(dialog().textContent).toContain("Claude is connected");
  });

  it("keeps the pasted code when Claude rejects it, with Try again", async () => {
    let attempts = 0;
    routes({
      "POST /ai/connectors/claude/login": () => jsonResponse(claudeLogin()),
      "POST /ai/connectors/claude/login/L1/code": () => {
        attempts += 1;
        return attempts === 1
          ? jsonResponse({ error: "Invalid code" }, 400)
          : jsonResponse({
              loginId: "L1",
              provider: "claude",
              state: "succeeded",
              error: null,
              connector: connector("claude"),
            });
      },
    });
    render("claude");
    await flush();
    typeInto(codeInput(), "wrong#code");
    click(button("Connect"));
    await flush();
    expect(alertBox()?.textContent).toContain("Invalid code");
    expect(codeInput().value).toBe("wrong#code");
    click(button("Try again"));
    await flush();
    expect(attempts).toBe(2);
    expect(dialog().textContent).toContain("Claude is connected");
  });

  it("counts down the link, turns amber under 2 minutes and offers a new link when expired", async () => {
    vi.useFakeTimers();
    let starts = 0;
    routes({
      "POST /ai/connectors/claude/login": () => {
        starts += 1;
        return jsonResponse(
          claudeLogin({
            loginId: `L${starts}`,
            expiresAt: inFuture(starts === 1 ? 125_000 : 600_000),
          }),
        );
      },
    });
    render("claude");
    await flush();
    const chip = () => dialog().querySelector(".wpn-ai-connect__expiry");
    expect(chip()?.textContent).toContain("Link expires in 2:05");
    expect(chip()?.classList.contains("wpn-ai-connect__expiry--soon")).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(chip()?.classList.contains("wpn-ai-connect__expiry--soon")).toBe(true);

    typeInto(codeInput(), "late#code");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(chip()?.textContent).toContain("Link expired");
    expect(button("Connect")?.getAttribute("aria-disabled")).toBe("true");
    expect(cancelCalls().map((call) => call.path)).toEqual([
      "/ai/connectors/claude/login/L1/cancel",
    ]);

    click(button("Get a new link"));
    await flush();
    expect(starts).toBe(2);
    expect(chip()?.textContent).toContain("Link expires in 10:00");
    expect(codeInput().value).toBe("");
  });
});

describe("ConnectDialog — already connected", () => {
  it("goes straight to success when the server says the account is already signed in", async () => {
    const connected = connector("claude", {
      account: { email: "kavi@example.com", plan: "Max", organization: null },
    });
    routes({
      "POST /ai/connectors/claude/login": () =>
        jsonResponse({
          loginId: null,
          provider: "claude",
          method: "link_paste",
          url: null,
          userCode: null,
          needsCode: false,
          expiresAt: inFuture(0),
          alreadyConnected: true,
          connector: connected,
        }),
    });
    render("claude");
    await flush();
    expect(dialog().textContent).toContain("Claude is connected");
    expect(dialog().textContent).toContain("Signed in as kavi@example.com · Max");
    expect(mergeConnectors).toHaveBeenCalledWith([connected]);
    expect(onConnected).toHaveBeenCalledWith(connected);
    expect(JSON.parse(window.localStorage.getItem("wpn-ai:defaults") ?? "null")).toEqual({
      provider: "claude",
      model: null,
      effort: null,
    });
    expect(openSpy).not.toHaveBeenCalled();
    act(() => root.unmount());
    root = createRoot(container);
    await flush();
    expect(cancelCalls()).toEqual([]);
  });
});

describe("ConnectDialog — Codex subscription", () => {
  it("shows the device code, then finishes by itself from the stream (no polling)", async () => {
    vi.useFakeTimers();
    const connected = connector("codex", {
      account: { email: "dev@example.com", plan: "Plus", organization: null },
    });
    routes({ "POST /ai/connectors/codex/login": () => jsonResponse(codexLogin()) });
    render("codex");
    await flush();
    expect(button(/ChatGPT subscription/)?.textContent).toContain("Plus, Pro or Team");
    expect(button(/OpenAI platform key/)).not.toBeNull();
    expect(document.body.querySelector('[aria-label="One-time code"]')?.textContent).toBe(
      "ABCD-1234",
    );
    expect(button("Copy code")).not.toBeNull();
    expect(openSpy).not.toHaveBeenCalled();

    click(button("Open ChatGPT"));
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith("https://auth.openai.com/codex/device", "_blank");
    expect(dialog().textContent).toContain("Waiting for you to approve in ChatGPT…");
    expect(dialog().textContent).toContain("This finishes by itself");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(calls().map((call) => `${call.method} ${call.path}`)).toEqual([
      "POST /ai/connectors/codex/login",
    ]);

    act(() => runtime.emit(loginEvent("succeeded", { loginId: "other", connector: connected })));
    expect(dialog().textContent).not.toContain("is connected");

    act(() => runtime.emit(loginEvent("succeeded", { connector: connected })));
    expect(dialog().textContent).toContain("Codex is connected");
    expect(dialog().textContent).toContain("Signed in as dev@example.com · Plus");
    expect(mergeConnectors).toHaveBeenCalledWith([connected]);
    expect(onConnected).toHaveBeenCalledWith(connected);
  });

  it("never copies or opens anything by itself; Copy copies the code on click", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText: vi.fn(async () => ""), writeText },
    });
    routes({ "POST /ai/connectors/codex/login": () => jsonResponse(codexLogin()) });
    render("codex");
    await flush();
    expect(writeText).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
    expect(dialog().textContent).not.toContain("Copied to your clipboard.");
    expect(dialog().textContent).toContain("Waiting for you to approve in ChatGPT…");
    click(button("Copy code"));
    await flush();
    expect(writeText).toHaveBeenCalledWith("ABCD-1234");
  });

  it("checks the login once after a stream reconnect", async () => {
    const connected = connector("codex");
    routes({
      "POST /ai/connectors/codex/login": () => jsonResponse(codexLogin()),
      "GET /ai/connectors/codex/login/D1": () =>
        jsonResponse({
          loginId: "D1",
          provider: "codex",
          state: "succeeded",
          error: null,
          connector: connected,
        }),
    });
    render("codex");
    await flush();
    act(() => runtime.reconnect());
    await flush();
    expect(calls().filter((call) => call.method === "GET")).toHaveLength(1);
    expect(dialog().textContent).toContain("Codex is connected");
  });

  it("gives up at expiresAt, cancels the login and offers Try again", async () => {
    vi.useFakeTimers();
    let starts = 0;
    routes({
      "POST /ai/connectors/codex/login": () => {
        starts += 1;
        return jsonResponse(codexLogin({ expiresAt: inFuture(5000) }));
      },
    });
    render("codex");
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(alertBox()?.textContent).toContain("expired");
    expect(cancelCalls().map((call) => call.path)).toEqual([
      "/ai/connectors/codex/login/D1/cancel",
    ]);
    click(button("Try again"));
    await flush();
    expect(starts).toBe(2);
  });

  it("reports a failed login from the stream", async () => {
    routes({ "POST /ai/connectors/codex/login": () => jsonResponse(codexLogin()) });
    render("codex");
    await flush();
    act(() => runtime.emit({ ...loginEvent("failed"), error: "ChatGPT denied access" }));
    expect(alertBox()?.textContent).toContain("ChatGPT denied access");
    expect(button("Try again")).not.toBeNull();
  });
});

describe("ConnectDialog — API key", () => {
  it("shows/hides the key, explains where to get it and saves it", async () => {
    const connected = connector("codex", { auth: "api_key" });
    routes({
      "POST /ai/connectors/codex/login": () => jsonResponse(codexLogin()),
      "POST /ai/connectors/codex/api-key": () => jsonResponse(connected),
    });
    render("codex", { initialMethod: "api_key" });
    await flush();
    expect(calls()).toEqual([]);
    expect(dialog().textContent).toContain("platform.openai.com");
    const input = keyInput();
    expect(input.type).toBe("password");
    click(button("Show key"));
    expect(keyInput().type).toBe("text");
    click(button("Hide key"));
    expect(keyInput().type).toBe("password");

    expect(button("Save and connect")?.getAttribute("aria-disabled")).toBe("true");
    click(button("Save and connect"));
    expect(calls()).toEqual([]);
    typeInto(keyInput(), " sk-test-123 ");
    expect(button("Save and connect")?.getAttribute("aria-disabled")).toBeNull();
    click(button("Save and connect"));
    await flush();
    expect(calls()).toEqual([
      {
        method: "POST",
        path: "/ai/connectors/codex/api-key",
        scope: null,
        body: { apiKey: "sk-test-123" },
      },
    ]);
    expect(dialog().textContent).toContain("Codex is connected");
    expect(mergeConnectors).toHaveBeenCalledWith([connected]);
  });

  it("shows a rejected key inline with Try again", async () => {
    routes({
      "POST /ai/connectors/claude/login": () => jsonResponse(claudeLogin()),
      "POST /ai/connectors/claude/api-key": () =>
        jsonResponse({ error: "That API key was rejected" }, 400),
    });
    render("claude");
    await flush();
    click(button(/Pay as you go/));
    expect(dialog().textContent).toContain("console.anthropic.com");
    typeInto(keyInput(), "sk-bad");
    click(button("Save and connect"));
    await flush();
    expect(alertBox()?.textContent).toContain("That API key was rejected");
    expect(button("Try again")).not.toBeNull();
    expect(keyInput().value).toBe("sk-bad");
    expect(dialog().textContent).not.toContain("is connected");
  });

  it("cancels the running sign-in when switching to API key", async () => {
    routes({
      "POST /ai/connectors/codex/login": () => jsonResponse(codexLogin({ loginId: "D8" })),
    });
    render("codex");
    await flush();
    click(button(/OpenAI platform key/));
    await flush();
    expect(cancelCalls().map((call) => call.path)).toEqual([
      "/ai/connectors/codex/login/D8/cancel",
    ]);
    expect(keyInput()).not.toBeNull();
  });
});

describe("ConnectDialog — personal only", () => {
  it("never offers a Just me / Everyone switch, even for admins", async () => {
    routes({
      "POST /ai/connectors/codex/login": () => jsonResponse(codexLogin()),
    });
    render("codex", {}, { canManageAiTemplates: true });
    await flush();
    expect(dialog().textContent).not.toContain("Connect for");
    expect(button("Everyone")).toBeNull();
    expect(button("Just me")).toBeNull();
    expect(calls()[0]?.scope).toBeNull();
    expect(dialog().textContent).toContain("Only you will use this connection");
  });
});

describe("ConnectDialog — closing", () => {
  it("Cancel cancels the running sign-in and closes", async () => {
    routes({
      "POST /ai/connectors/codex/login": () => jsonResponse(codexLogin({ loginId: "D7" })),
    });
    render("codex");
    await flush();
    click(button("Cancel"));
    await flush();
    expect(onClose).toHaveBeenCalled();
    expect(cancelCalls()).toEqual([
      {
        method: "POST",
        path: "/ai/connectors/codex/login/D7/cancel",
        scope: null,
        body: undefined,
      },
    ]);
    act(() => root.unmount());
    root = createRoot(container);
    await flush();
    expect(cancelCalls()).toHaveLength(1);
  });

  it("Esc closes and cancels the sign-in", async () => {
    routes({
      "POST /ai/connectors/claude/login": () => jsonResponse(claudeLogin({ loginId: "L9" })),
    });
    render("claude");
    await flush();
    press(document.body, "Escape");
    await flush();
    expect(onClose).toHaveBeenCalled();
    expect(cancelCalls().map((call) => call.path)).toEqual([
      "/ai/connectors/claude/login/L9/cancel",
    ]);
  });

  it("announces status changes politely", async () => {
    routes({ "POST /ai/connectors/codex/login": () => jsonResponse(codexLogin()) });
    render("codex");
    await flush();
    const live = dialog().querySelector('[aria-live="polite"]');
    expect(live?.textContent).toContain("Waiting for you to approve in ChatGPT");
  });
});

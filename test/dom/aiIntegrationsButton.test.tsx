import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConnectionsPanel,
  ConnectorsPanel,
} from "../../src/features/ai/components/ConnectorsPanel";
import { IntegrationsButton } from "../../src/features/ai/components/IntegrationsButton";
import { IntegrationsTab } from "../../src/features/settings/components/IntegrationsTab";
import { AiRuntimeContext } from "../../src/features/ai/AiRuntimeContext";
import {
  AnnotationUiContext,
  type AnnotationUiContextValue,
} from "../../src/context/AnnotationContext";
import type { AiMe } from "../../src/types/ai.types";
import {
  aiMe,
  buttonByText,
  click,
  connector,
  fakeRuntime,
  flush,
  jsonResponse,
  signedOut,
} from "./aiTestUtils";

let container: HTMLDivElement;
let root: Root;
let setUserManagementOpen: ReturnType<typeof vi.fn>;
let mergeConnectors: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;
let onGoToConnectors: ReturnType<typeof vi.fn>;

function render(
  component: () => ReturnType<typeof createElement> | null,
  me: AiMe | null,
  meError: string | null = null,
) {
  const runtime = fakeRuntime({ me, meError, mergeConnectors });
  const ui = { setUserManagementOpen } as unknown as AnnotationUiContextValue;
  act(() =>
    root.render(
      createElement(
        AnnotationUiContext.Provider,
        { value: ui },
        createElement(
          AiRuntimeContext.Provider,
          { value: runtime.value },
          createElement(component),
        ),
      ),
    ),
  );
}

const Connections = () => createElement(ConnectionsPanel, { onGoToConnectors });
const card = (label: string) => container.querySelector(`[aria-label^="${label}:"]`);
const claudeMax = connector("claude", {
  account: { email: "kavi@example.com", plan: "Max", organization: null },
  lastUsedAt: new Date().toISOString(),
});

beforeEach(() => {
  setUserManagementOpen = vi.fn();
  mergeConnectors = vi.fn();
  onGoToConnectors = vi.fn();
  fetchMock = vi.fn(async () => new Response("{}", { status: 500 }));
  vi.stubGlobal("fetch", fetchMock);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  act(() => root.unmount());
  await flush();
  container.remove();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("IntegrationsButton", () => {
  it("stays visible with an error state when /ai/me fails, instead of disappearing", () => {
    render(IntegrationsButton, null, "Not found");
    const button = container.querySelector('[aria-label="AI integrations"]');
    expect(button).not.toBeNull();
    expect(button?.classList.contains("wpn-ai-integrations-btn--error")).toBe(true);
  });

  it("opens Settings and reports whether an agent is connected", () => {
    render(IntegrationsButton, aiMe());
    expect(container.querySelector(".wpn-ai-integrations-btn--ready")).toBeNull();
    click(container.querySelector('[aria-label="AI integrations"]'));
    expect(setUserManagementOpen).toHaveBeenCalledWith(true);
    render(IntegrationsButton, aiMe({ connectors: [claudeMax, signedOut("codex")] }));
    expect(container.querySelector(".wpn-ai-integrations-btn--ready")).not.toBeNull();
  });
});

describe("ConnectorsPanel", () => {
  it("shows one card per agent with a single Connect action", () => {
    render(ConnectorsPanel, aiMe());
    expect(container.textContent).not.toMatch(/bridge|cursor|terminal/i);
    for (const label of ["Claude", "Codex"]) {
      expect(card(label)?.getAttribute("aria-label")).toBe(`${label}: Not connected`);
      const actions = card(label)?.querySelectorAll("button");
      expect(actions).toHaveLength(1);
      expect(actions?.[0]?.textContent).toBe("Connect");
    }
    expect(card("Claude")?.textContent).toContain("Anthropic's coding agent");
    expect(card("Codex")?.textContent).toContain("OpenAI's coding agent");
    expect(container.textContent).not.toContain("Default model");
  });

  it("opens the Connect dialog for that agent", () => {
    render(ConnectorsPanel, aiMe());
    click(card("Codex")?.querySelector("button"));
    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain("Connect Codex");
    expect(document.body.textContent).toContain("Only you will use this connection");
  });

  it("shows who a connected agent is signed in as, with Disconnect and the default model", () => {
    render(
      ConnectorsPanel,
      aiMe({
        connectors: [
          claudeMax,
          signedOut("codex", { status: "error", error: "Your ChatGPT sign-in expired." }),
        ],
      }),
    );
    const claude = container.querySelector('[aria-label="Claude: Using your account"]');
    expect(claude?.textContent).toContain("Using your account");
    expect(claude?.textContent).toContain("kavi@example.com");
    expect(claude?.textContent).toContain("Max");
    expect(buttonByText(claude!, "Disconnect Claude")).not.toBeNull();
    const codex = container.querySelector('[aria-label="Codex: Not connected"]');
    expect(codex?.textContent).toContain("Your ChatGPT sign-in expired.");
    expect(buttonByText(codex!, "Reconnect")).not.toBeNull();
    expect(container.textContent).not.toContain("Default model");
  });

  it("disconnects after confirming", async () => {
    const loggedOut = signedOut("claude");
    fetchMock.mockImplementation(async () => jsonResponse(loggedOut));
    render(ConnectorsPanel, aiMe({ connectors: [claudeMax, signedOut("codex")] }));
    click(buttonByText(container, "Disconnect Claude"));
    expect(document.body.textContent).toContain("Disconnect Claude?");
    expect(document.body.textContent).toContain("This signs kavi@example.com out of Pinnote.");
    expect(document.body.textContent).toContain("You'll need to sign in to Claude again");
    expect(fetchMock).not.toHaveBeenCalled();
    const dialog = document.body.querySelector('[role="alertdialog"], [role="dialog"]')!;
    click(buttonByText(dialog, "Disconnect"));
    await flush();
    const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(url).toBe(
      "https://api.example.com/api/v1/pinnote/ai/connectors/claude/logout?projectId=p1",
    );
    expect(init.method).toBe("POST");
    expect(mergeConnectors).toHaveBeenCalledWith([loggedOut]);
  });

  it("marks agents the server does not enable", () => {
    render(ConnectorsPanel, aiMe({ providers: ["claude"] }));
    expect(card("Codex")?.textContent).toContain("Not enabled on this Pinnote server");
    expect(card("Codex")?.querySelector("button")).toBeNull();
  });

  it("has no shared connection controls, even for admins", () => {
    render(ConnectorsPanel, aiMe({ canManageAiTemplates: true }));
    expect(container.textContent).not.toMatch(/shared|everyone/i);
    for (const label of ["Claude", "Codex"]) {
      expect(card(label)?.querySelectorAll("button")).toHaveLength(1);
    }
  });
});

describe("ConnectionsPanel", () => {
  it("shows a friendly empty state that points to Connectors", () => {
    render(Connections, aiMe());
    expect(container.textContent).not.toContain("Your connections");
    expect(container.textContent).not.toContain("Shared with this project");
    expect(container.querySelectorAll("table")).toHaveLength(1);
    expect(container.textContent).toContain("You haven't connected an agent yet");
    click(buttonByText(container, "Go to Connectors"));
    expect(onGoToConnectors).toHaveBeenCalled();
  });

  it("lists connected agents with account, plan, method and actions", async () => {
    const codexKey = connector("codex", { auth: "api_key" });
    render(Connections, aiMe({ connectors: [claudeMax, codexKey] }));
    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("Claude");
    expect(rows[0]?.textContent).toContain("kavi@example.com");
    expect(rows[0]?.textContent).toContain("Max");
    expect(rows[0]?.textContent).toContain("Subscription");
    expect(rows[0]?.textContent).toContain("just now");
    expect(rows[0]?.textContent).toContain("Connected");
    expect(rows[1]?.textContent).toContain("API key");
    expect(rows[1]?.textContent).toContain("Not yet");

    const fresh = [{ ...claudeMax, checkedAt: new Date().toISOString() }, codexKey];
    fetchMock.mockImplementation(async () => jsonResponse(fresh));
    click(buttonByText(rows[0]!, "Check Claude now"));
    await flush();
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toBe(
      "https://api.example.com/api/v1/pinnote/ai/connectors?projectId=p1&refresh=1",
    );
    expect(mergeConnectors).toHaveBeenCalledWith(fresh);

    click(buttonByText(rows[1]!, "Reconnect Codex"));
    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain("Connect Codex");
  });

  it("has no Connected by column", () => {
    render(Connections, aiMe({ connectors: [claudeMax, signedOut("codex")] }));
    const heads = [...container.querySelectorAll("thead th")].map((th) => th.textContent);
    expect(heads).not.toContain("Connected by");
    expect(heads).toContain("Actions");
  });
});

describe("IntegrationsTab", () => {
  it("has Connectors and Connections tabs and no organization AI policy form", () => {
    render(IntegrationsTab, aiMe({ connectors: [claudeMax, signedOut("codex")] }));
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Connectors", "Connections1"]);
    expect(container.textContent).not.toContain("Organization AI policy");
    click(tabs[1]!);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(1);

    render(IntegrationsTab, aiMe({ canManageAiTemplates: true }));
    click(container.querySelector('[role="tab"]'));
    expect(container.textContent).not.toContain("Organization AI policy");
    expect(container.querySelector(".wpn-ai-policy")).toBeNull();
    expect(container.querySelector('input[type="number"]')).toBeNull();
    expect(container.textContent).not.toContain("Shared with everyone");
    expect(container.textContent).not.toMatch(/code mode/i);
  });
});

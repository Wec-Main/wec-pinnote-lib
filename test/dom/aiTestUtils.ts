import { act } from "react";
import type { AiRuntimeContextValue } from "../../src/features/ai/AiRuntimeContext";
import type { AiReconnectListener, AiStreamListener } from "../../src/features/ai/AiStreamHub";
import type { AiStreamReconnect } from "../../src/hooks/useAiStream";
import type { AiConnector, AiMe, AiProviderId, AiStreamEvent } from "../../src/types/ai.types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export const T0 = "2026-01-01T00:00:00.000Z";
export const API = "https://api.example.com";

export function connector(id: AiProviderId, overrides: Partial<AiConnector> = {}): AiConnector {
  return {
    provider: id,
    status: "connected",
    auth: "subscription",
    account: null,
    cliVersion: "1.0.0",
    models: [
      {
        id: `${id}-model`,
        label: `${id} model`,
        description: "",
        efforts: [],
        defaultEffort: null,
        isDefault: true,
      },
    ],
    error: null,
    connectedAt: T0,
    checkedAt: T0,
    lastUsedAt: null,
    ...overrides,
  };
}

export function signedOut(id: AiProviderId, overrides: Partial<AiConnector> = {}): AiConnector {
  return connector(id, {
    status: "signed_out",
    auth: null,
    models: [],
    connectedAt: null,
    ...overrides,
  });
}

export function aiMe(overrides: Partial<AiMe> = {}): AiMe {
  return {
    providers: ["claude", "codex"],
    connectors: [signedOut("claude"), signedOut("codex")],
    canUseAi: true,
    canApplyModelOps: true,
    ...overrides,
  };
}

export interface FakeRuntime {
  value: AiRuntimeContextValue;
  emit: (event: AiStreamEvent) => void;
  reconnect: (reconnect?: AiStreamReconnect) => void;
}

export function fakeRuntime(overrides: Partial<AiRuntimeContextValue> = {}): FakeRuntime {
  const listeners = new Set<AiStreamListener>();
  const reconnectListeners = new Set<AiReconnectListener>();
  const value: AiRuntimeContextValue = {
    apiBaseUrl: API,
    projectId: "p1",
    enabled: true,
    currentUserId: "u1",
    getToken: async () => "tok",
    me: aiMe(),
    meLoading: false,
    meError: null,
    meRetrying: false,
    refreshMe: () => undefined,
    mergeConnectors: () => undefined,
    subscribe: (listener, onReconnect) => {
      listeners.add(listener);
      if (onReconnect) reconnectListeners.add(onReconnect);
      return () => {
        listeners.delete(listener);
        if (onReconnect) reconnectListeners.delete(onReconnect);
      };
    },
    connection: "open",
    reconnect: () => undefined,
    ...overrides,
  };
  return {
    value,
    emit: (event) => {
      for (const listener of [...listeners]) listener(event);
    },
    reconnect: (reconnect = { resumed: false }) => {
      for (const listener of [...reconnectListeners]) listener(reconnect);
    },
  };
}

export async function flush(rounds = 10): Promise<void> {
  await act(async () => {
    for (let i = 0; i < rounds; i++) await Promise.resolve();
  });
}

export function typeInto(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  act(() => {
    setter?.call(element, value);
    element.setSelectionRange?.(value.length, value.length);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

export function press(element: Element, key: string, init: KeyboardEventInit = {}): void {
  act(() => {
    element.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }),
    );
  });
}

export function click(element: Element | null | undefined): void {
  if (!element) throw new Error("Nothing to click");
  act(() => {
    (element as HTMLElement).click();
  });
}

export function buttonByText(root: ParentNode, text: string | RegExp): HTMLButtonElement | null {
  const buttons = Array.from(root.querySelectorAll("button"));
  return (
    buttons.find((button) =>
      typeof text === "string"
        ? button.textContent?.trim() === text || button.getAttribute("aria-label") === text
        : text.test(button.textContent ?? "") || text.test(button.getAttribute("aria-label") ?? ""),
    ) ?? null
  );
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status });
}

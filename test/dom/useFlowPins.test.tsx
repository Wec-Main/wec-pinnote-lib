import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFlowPins, type FlowPinsState } from "../../src/hooks/useFlowPins";
import type { FlowPin } from "../../src/types/flowPin.types";
import type { StreamEvent } from "../../src/types/stream.types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const fetchFlowPins = vi.fn();
const createFlowPin = vi.fn();
const deleteFlowPin = vi.fn();

vi.mock("../../src/services/flowchartService", () => ({
  fetchFlowPins: (...args: unknown[]) => fetchFlowPins(...args),
  createFlowPin: (...args: unknown[]) => createFlowPin(...args),
  deleteFlowPin: (...args: unknown[]) => deleteFlowPin(...args),
}));

function flowPin(id: string, projectVersionId: string | undefined, updatedAt: string): FlowPin {
  return {
    id,
    projectId: "project-1",
    projectVersionId,
    pageKey: "/home",
    flowId: "flow-1",
    name: `Pin ${id}`,
    anchor: {
      selector: "body",
      elementIdentifier: "x",
      relativeX: 0,
      relativeY: 0,
      fallbackX: 0,
      fallbackY: 0,
      viewportWidth: 0,
      viewportHeight: 0,
    },
    createdById: null,
    createdByUser: null,
    createdAt: updatedAt,
    updatedAt,
  };
}

function flowPinEvent(
  eventType: "flow_pin.created" | "flow_pin.updated",
  pin: FlowPin,
): StreamEvent {
  return {
    eventId: `evt-${pin.id}`,
    projectId: "project-1",
    pageKey: "/home",
    annotationId: null,
    commentId: null,
    actorUserId: null,
    createdAt: pin.updatedAt,
    eventType,
    payload: { flowPin: pin },
  } as StreamEvent;
}

let container: HTMLDivElement;
let root: Root;
let latest: FlowPinsState | null = null;

function Harness({ projectVersionId }: { projectVersionId: string | undefined }) {
  latest = useFlowPins({
    apiBaseUrl: "https://api.example.test",
    projectId: "project-1",
    projectVersionId,
    pageKey: "/home",
    getAuthToken: () => "token",
    sessionKey: "session",
    enabled: true,
  });
  return null;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  fetchFlowPins.mockReset().mockResolvedValue([]);
  createFlowPin.mockReset();
  deleteFlowPin.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  latest = null;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("useFlowPins (on usePageScopedResource)", () => {
  it("loads flow pins for the given scope on mount", async () => {
    const pin = flowPin("pin-1", "v1", "2026-01-01T00:00:00.000Z");
    fetchFlowPins.mockResolvedValue([pin]);

    act(() => root.render(createElement(Harness, { projectVersionId: "v1" })));
    await flush();

    expect(fetchFlowPins).toHaveBeenCalledWith(
      "https://api.example.test",
      "token",
      "project-1",
      "/home",
      "v1",
      expect.any(AbortSignal),
    );
    expect(latest!.flowPins).toEqual([pin]);
  });

  it("refetches when reloadFlowPins is called", async () => {
    act(() => root.render(createElement(Harness, { projectVersionId: "v1" })));
    await flush();
    expect(fetchFlowPins).toHaveBeenCalledTimes(1);

    act(() => latest!.reloadFlowPins());
    await flush();
    expect(fetchFlowPins).toHaveBeenCalledTimes(2);
  });

  it("drops a flow_pin event for a project version other than the one in view (the ported stale-version guard)", async () => {
    act(() => root.render(createElement(Harness, { projectVersionId: "v1" })));
    await flush();
    expect(latest!.flowPins).toEqual([]);

    const staleEvent = flowPinEvent(
      "flow_pin.created",
      flowPin("pin-stale", "v2", "2026-01-01T00:00:00.000Z"),
    );
    act(() => latest!.applyFlowPinEvent(staleEvent));
    expect(latest!.flowPins).toEqual([]);

    const freshEvent = flowPinEvent(
      "flow_pin.created",
      flowPin("pin-fresh", "v1", "2026-01-01T00:00:00.000Z"),
    );
    act(() => latest!.applyFlowPinEvent(freshEvent));
    expect(latest!.flowPins.map((item) => item.id)).toEqual(["pin-fresh"]);
  });

  it("clears items and resets the draft/selection when the page scope changes", async () => {
    const pin = flowPin("pin-1", "v1", "2026-01-01T00:00:00.000Z");
    fetchFlowPins.mockResolvedValue([pin]);

    function ScopedHarness({ pageKey }: { pageKey: string }) {
      latest = useFlowPins({
        apiBaseUrl: "https://api.example.test",
        projectId: "project-1",
        projectVersionId: "v1",
        pageKey,
        getAuthToken: () => "token",
        sessionKey: "session",
        enabled: true,
      });
      return null;
    }

    act(() => root.render(createElement(ScopedHarness, { pageKey: "/home" })));
    await flush();
    expect(latest!.flowPins).toEqual([pin]);

    act(() => latest!.selectFlowPin("pin-1"));
    expect(latest!.selectedFlowPinId).toBe("pin-1");

    fetchFlowPins.mockResolvedValue([]);
    act(() => root.render(createElement(ScopedHarness, { pageKey: "/other" })));
    expect(latest!.flowPins).toEqual([]);

    await flush();
    expect(fetchFlowPins).toHaveBeenLastCalledWith(
      "https://api.example.test",
      "token",
      "project-1",
      "/other",
      "v1",
      expect.any(AbortSignal),
    );
  });
});

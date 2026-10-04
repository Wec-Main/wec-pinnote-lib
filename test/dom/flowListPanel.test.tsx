import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FlowListPanel } from "../../src/features/flowchart/components/FlowListPanel";
import { click, flush } from "./aiTestUtils";

const mocks = vi.hoisted(() => ({
  roleId: "admin" as string,
  fetchFlowDocument: vi.fn(),
  downloadJson: vi.fn(),
}));

const flowRow = {
  id: "f1",
  name: "Checkout flow",
  pinPageKey: null,
  nodeCount: 3,
  createdByUser: "Ada",
  createdById: "u9",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

vi.mock("../../src/context/AnnotationContext", () => ({
  useAnnotationContext: () => ({
    config: {
      apiBaseUrl: "https://api.example.com",
      projectId: "p1",
      getAuthToken: async () => "tok",
      currentUser: { id: "u1", role: "member" },
    },
    flowsVersionId: undefined,
  }),
  useAnnotationAuth: () => ({
    hostAuthenticated: false,
    activeAccount: { id: "a1", roleId: mocks.roleId },
  }),
}));

vi.mock("../../src/hooks/useSharedFetch", () => ({
  useSharedFetch: () => ({
    data: { flows: [flowRow], total: 1, limit: 10, offset: 0 },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock("../../src/hooks/useFlowStream", () => ({ useFlowStream: () => undefined }));
vi.mock("../../src/hooks/useTokenGetter", () => ({
  useTokenGetter: (getter: () => Promise<string>) => getter,
}));

vi.mock("../../src/services/flowchartService", () => ({
  deleteFlow: vi.fn(),
  listFlows: vi.fn(),
  fetchFlowDocument: mocks.fetchFlowDocument,
}));

vi.mock("../../src/utils/downloadJson", () => ({ downloadJson: mocks.downloadJson }));

let container: HTMLDivElement;
let root: Root;
const onOpen = vi.fn();

async function mount() {
  act(() => root.render(createElement(FlowListPanel, { onOpen })));
  await flush();
}

const labels = () =>
  Array.from(container.querySelectorAll("button")).map((button) => button.textContent?.trim());

beforeEach(() => {
  mocks.roleId = "admin";
  mocks.fetchFlowDocument.mockReset().mockResolvedValue({ nodes: [], edges: [] });
  mocks.downloadJson.mockReset();
  onOpen.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("FlowListPanel", () => {
  it("labels the row action Open and opens the flow", async () => {
    await mount();
    expect(labels()).toContain("Open");
    expect(labels()).not.toContain("Edit");
    click(
      container.querySelector('button[aria-label="Open Checkout flow"]:not(.wpn-users-identity)'),
    );
    expect(onOpen).toHaveBeenCalledWith("f1");
  });

  it("exports the flow document as JSON for admins", async () => {
    await mount();
    click(container.querySelector('button[aria-label="Export Checkout flow"]'));
    await flush();
    const jsonItem = Array.from(container.querySelectorAll('button[role="menuitem"]')).find(
      (button) => button.textContent?.trim() === "Export as JSON",
    );
    click(jsonItem);
    await flush();
    expect(mocks.fetchFlowDocument).toHaveBeenCalledWith("https://api.example.com", "tok", "f1");
    expect(mocks.downloadJson).toHaveBeenCalledTimes(1);
    expect(mocks.downloadJson.mock.calls[0]![0]).toBe("flow_Checkout_flow.json");
  });

  it("hides Export for non-admin roles", async () => {
    mocks.roleId = "member";
    await mount();
    expect(container.querySelector('button[aria-label="Export Checkout flow"]')).toBeNull();
    expect(labels()).toContain("Open");
  });
});

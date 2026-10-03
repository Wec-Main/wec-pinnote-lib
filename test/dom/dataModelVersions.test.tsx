import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataModelDocumentEditor } from "../../src/components/DataModel/DataModelDocumentEditor";
import type { DataModelDocumentState } from "../../src/hooks/useDataModelDocument";
import type { ErdEditorProps } from "../../src/components/DataModel/erd/ErdEditor";
import type { DataModelVersionRecord, ErdDocumentJSON } from "../../src/types/dataModel.types";
import { blogDocument } from "../erdFixtures";
import { API, T0, buttonByText, click, flush } from "./aiTestUtils";

const mocks = vi.hoisted(() => ({
  listDataModelVersions: vi.fn(),
  fetchDataModelVersion: vi.fn(),
  engineDocument: null as unknown,
}));

vi.mock("../../src/context/AnnotationContext", () => ({
  useAnnotationContext: () => ({
    config: { apiBaseUrl: "https://api.example.com", getAuthToken: async () => "tok" },
  }),
}));

vi.mock("../../src/services/dataModelApi", () => ({
  listDataModelVersions: mocks.listDataModelVersions,
  fetchDataModelVersion: mocks.fetchDataModelVersion,
}));

vi.mock("../../src/ai/aiDockState", () => ({
  useAiDockControl: () => ({ show: vi.fn() }),
}));

vi.mock("../../src/ai/useAiOpBatchApplier", () => ({
  useAiOpBatchApplier: () => ({ hasUnsavedAiChanges: false, discard: vi.fn() }),
}));

vi.mock("../../src/components/Ai/ErdAiIntegration", async () => {
  const { useEffect, createElement: h } = await import("react");
  return {
    AiUnsavedChanges: () => null,
    AskAiButton: () => null,
    ErdAiBar: ({ onSnapshot }: { onSnapshot?: () => Promise<void> }) => {
      return onSnapshot
        ? h("button", { type: "button", onClick: () => void onSnapshot() }, "Snapshot")
        : null;
    },
    ErdEngineReporter: ({ onEngine }: { onEngine: (engine: unknown) => void }) => {
      useEffect(() => {
        onEngine({ toJSON: () => mocks.engineDocument });
      }, [onEngine]);
      return null;
    },
  };
});

vi.mock("../../src/components/DataModel/erd/ErdEditor", async () => {
  const { createElement: h } = await import("react");
  return {
    ErdEditor: (props: ErdEditorProps) =>
      h(
        "div",
        {
          "data-testid": "erd",
          "data-readonly": String(Boolean(props.readOnly)),
          "data-entities": String(props.initialDocument.entities.length),
        },
        props.toolbarActions,
        props.onPublish
          ? h(
              "button",
              {
                type: "button",
                onClick: () => void props.onPublish?.(props.initialDocument),
              },
              "Publish",
            )
          : null,
        props.overlay,
      ),
  };
});

const draftDocument: ErdDocumentJSON = { ...blogDocument(), entities: [] };

function versionRecord(version: number): DataModelVersionRecord {
  return {
    id: `v${version}`,
    dataModelId: "d1",
    version,
    publishedById: "u1",
    publishedByUser: "Ada",
    publishedAt: T0,
  };
}

let container: HTMLDivElement;
let root: Root;
let publish: ReturnType<typeof vi.fn>;

function documentState(): DataModelDocumentState {
  return {
    status: "ready",
    document: draftDocument,
    loadKey: 1,
    error: null,
    saveError: null,
    saveState: "idle",
    savedCount: 0,
    hasUnsavedChanges: false,
    revision: 1,
    scheduleSave: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
    publish,
    reload: vi.fn(),
    applyRemoteRevision: vi.fn(),
  } as unknown as DataModelDocumentState;
}

async function mount() {
  act(() =>
    root.render(
      createElement(DataModelDocumentEditor, {
        dataModelDocument: documentState(),
        dataModelId: "d1",
        name: "Blog",
        signedIn: true,
      }),
    ),
  );
  await flush();
}

const versionsButton = () => buttonByText(container, "Versions");
const editor = () => container.querySelector('[data-testid="erd"]');
const panel = () => container.querySelector(".wpn-flow-versions-panel");

beforeEach(() => {
  publish = vi.fn().mockResolvedValue(undefined);
  mocks.engineDocument = draftDocument;
  mocks.listDataModelVersions.mockReset().mockResolvedValue([versionRecord(1), versionRecord(2)]);
  mocks.fetchDataModelVersion.mockReset().mockResolvedValue({
    ...versionRecord(2),
    document: blogDocument(),
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("DataModelDocumentEditor versions", () => {
  it("disables the Versions button when nothing is published", async () => {
    mocks.listDataModelVersions.mockResolvedValue([]);
    await mount();
    expect(mocks.listDataModelVersions).toHaveBeenCalledWith(API, "tok", "d1");
    expect(versionsButton()?.disabled).toBe(true);
    expect(versionsButton()?.title).toBe("No published versions yet");
  });

  it("opens the version history panel with newest versions first", async () => {
    await mount();
    expect(versionsButton()?.disabled).toBe(false);
    click(versionsButton());
    await flush();
    expect(versionsButton()?.getAttribute("aria-pressed")).toBe("true");
    const names = Array.from(container.querySelectorAll(".wpn-flow-version-item__name")).map(
      (node) => node.textContent,
    );
    expect(names).toEqual(["Current draft", "Version 2Latest", "Version 1"]);
    click(container.querySelector('button[aria-label="Close version history"]'));
    expect(panel()).toBeNull();
  });

  it("previews a published version read-only and returns to the draft", async () => {
    await mount();
    click(versionsButton());
    await flush();
    click(buttonByText(container, /Version 2/));
    await flush();
    expect(mocks.fetchDataModelVersion).toHaveBeenCalledWith(API, "tok", "d1", 2);
    expect(editor()?.getAttribute("data-readonly")).toBe("true");
    expect(editor()?.getAttribute("data-entities")).toBe(String(blogDocument().entities.length));
    expect(container.querySelector(".wpn-flow-stage__preview-banner")?.textContent).toContain(
      "Viewing Version 2 · Published by Ada",
    );
    expect(buttonByText(container, "Publish")).toBeNull();
    click(buttonByText(container, "Back to draft"));
    expect(container.querySelector(".wpn-flow-stage__preview-banner")).toBeNull();
    expect(editor()?.getAttribute("data-readonly")).toBe("false");
    expect(editor()?.getAttribute("data-entities")).toBe("0");
  });

  it("shows an error when a version cannot be loaded", async () => {
    mocks.fetchDataModelVersion.mockRejectedValue(new Error("Version gone"));
    await mount();
    click(versionsButton());
    await flush();
    click(buttonByText(container, /Version 1/));
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Version gone");
    click(buttonByText(container, "Dismiss"));
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("refreshes the version list after publishing", async () => {
    mocks.listDataModelVersions.mockResolvedValue([]);
    await mount();
    expect(versionsButton()?.disabled).toBe(true);
    mocks.listDataModelVersions.mockResolvedValue([versionRecord(1)]);
    click(buttonByText(container, "Publish"));
    await flush();
    expect(publish).toHaveBeenCalledWith(draftDocument);
    expect(mocks.listDataModelVersions).toHaveBeenCalledTimes(2);
    expect(versionsButton()?.disabled).toBe(false);
  });

  it("exposes a snapshot callback that publishes the engine document and refreshes", async () => {
    await mount();
    const snapshotDocument = blogDocument();
    mocks.engineDocument = snapshotDocument;
    click(buttonByText(container, "Snapshot"));
    await flush();
    expect(publish).toHaveBeenCalledWith(snapshotDocument);
    expect(mocks.listDataModelVersions).toHaveBeenCalledTimes(2);
  });
});

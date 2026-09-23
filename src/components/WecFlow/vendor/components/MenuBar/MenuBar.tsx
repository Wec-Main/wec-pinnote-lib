import type { FC, RefObject } from "react";
import { Icon, Menu, Tooltip, type MenuDefinition } from "../../../../primitives";
import type { FlowBuilderRef } from "../../types/flow.types";
import { triggerDownload } from "../../utils/download";
import "./menu-bar.css";

function sanitizedFilename(flow: FlowBuilderRef): string {
  const name = flow.getFlow().name;
  const sanitized = name.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized.length > 0 ? sanitized : "flow";
}

function handleExportSVG(flow: FlowBuilderRef | null): void {
  if (!flow) return;
  const svg = flow.exportSVG();
  triggerDownload(svg, `${sanitizedFilename(flow)}.svg`);
}

function handleExportPNG(flow: FlowBuilderRef | null): void {
  if (!flow) return;
  const filename = sanitizedFilename(flow);
  void flow
    .exportPNG()
    .then((blob) => triggerDownload(blob, `${filename}.png`))
    .catch((error: unknown) => {
      throw error;
    });
}

export interface MenuBarProps {
  flowRef: RefObject<FlowBuilderRef | null>;
  readonly?: boolean;
  gridVisible: boolean;
  onToggleGrid: (visible: boolean) => void;
  rulersVisible: boolean;
  onToggleRulers: (visible: boolean) => void;
  outlineVisible: boolean;
  onToggleOutline: (visible: boolean) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onNewFlow: () => void;
  onExportOpen: () => void;
  onImportOpen: () => void;
  onValidate: () => void;
  onToggleReadonly: (readonly: boolean) => void;
}

function buildFileMenu(props: MenuBarProps): MenuDefinition {
  const flow = props.flowRef.current;
  return {
    id: "file",
    label: "File",
    items: [
      {
        type: "action",
        id: "new",
        label: "New",
        icon: "plus",
        disabled: props.readonly,
        onSelect: props.onNewFlow,
      },
      {
        type: "action",
        id: "new-page",
        label: "New Page",
        disabled: props.readonly,
        onSelect: () => flow?.addPage(),
      },
      { type: "separator", id: "file-sep-1" },
      {
        type: "action",
        id: "import-json",
        label: "Import JSON",
        icon: "upload",
        disabled: props.readonly,
        onSelect: props.onImportOpen,
      },
      {
        type: "action",
        id: "export-json",
        label: "Export JSON",
        icon: "download",
        onSelect: props.onExportOpen,
      },
      {
        type: "action",
        id: "export-svg",
        label: "Export SVG",
        icon: "download",
        onSelect: () => handleExportSVG(flow),
      },
      {
        type: "action",
        id: "export-png",
        label: "Export PNG",
        icon: "download",
        onSelect: () => handleExportPNG(flow),
      },
    ],
  };
}

function buildEditMenu(props: MenuBarProps): MenuDefinition {
  const flow = props.flowRef.current;
  return {
    id: "edit",
    label: "Edit",
    items: [
      {
        type: "action",
        id: "undo",
        label: "Undo",
        icon: "reset",
        shortcut: "Ctrl+Z",
        disabled: props.readonly || !(flow?.canUndo() ?? false),
        onSelect: () => flow?.undo(),
      },
      {
        type: "action",
        id: "redo",
        label: "Redo",
        icon: "redo",
        shortcut: "Ctrl+Shift+Z",
        disabled: props.readonly || !(flow?.canRedo() ?? false),
        onSelect: () => flow?.redo(),
      },
      { type: "separator", id: "edit-sep-1" },
      {
        type: "action",
        id: "cut",
        label: "Cut",
        shortcut: "Ctrl+X",
        disabled: true,
        disabledReason: "Clipboard cut is not yet supported — use Duplicate (Ctrl+D) instead",
        onSelect: () => undefined,
      },
      {
        type: "action",
        id: "copy",
        label: "Copy",
        icon: "copy",
        shortcut: "Ctrl+C",
        disabled: true,
        disabledReason: "Clipboard copy is not yet supported — use Duplicate (Ctrl+D) instead",
        onSelect: () => undefined,
      },
      {
        type: "action",
        id: "paste",
        label: "Paste",
        shortcut: "Ctrl+V",
        disabled: true,
        disabledReason: "Clipboard paste is not yet supported — use Duplicate (Ctrl+D) instead",
        onSelect: () => undefined,
      },
      { type: "separator", id: "edit-sep-2" },
      {
        type: "action",
        id: "delete",
        label: "Delete",
        icon: "trash",
        shortcut: "Del",
        disabled: props.readonly,
        onSelect: () => flow?.deleteSelected(),
      },
      {
        type: "action",
        id: "select-all",
        label: "Select All",
        shortcut: "Ctrl+A",
        disabled: props.readonly,
        onSelect: () => flow?.selectAll(),
      },
    ],
  };
}

function buildViewMenu(props: MenuBarProps): MenuDefinition {
  const flow = props.flowRef.current;
  return {
    id: "view",
    label: "View",
    items: [
      {
        type: "action",
        id: "zoom-in",
        label: "Zoom In",
        shortcut: "Ctrl+=",
        onSelect: () => flow?.zoomIn(),
      },
      {
        type: "action",
        id: "zoom-out",
        label: "Zoom Out",
        shortcut: "Ctrl+-",
        onSelect: () => flow?.zoomOut(),
      },
      {
        type: "action",
        id: "reset-zoom",
        label: "Reset Zoom",
        onSelect: () => flow?.resetZoom(),
      },
      {
        type: "action",
        id: "fit-view",
        label: "Fit View",
        icon: "expand",
        onSelect: () => flow?.fitView(),
      },
      { type: "separator", id: "view-sep-1" },
      {
        type: "checkbox",
        id: "toggle-grid",
        label: "Grid",
        checked: props.gridVisible,
        onToggle: props.onToggleGrid,
      },
      {
        type: "checkbox",
        id: "toggle-rulers",
        label: "Rulers",
        checked: props.rulersVisible,
        onToggle: props.onToggleRulers,
      },
      {
        type: "checkbox",
        id: "toggle-outline",
        label: "Outline",
        checked: props.outlineVisible,
        onToggle: props.onToggleOutline,
      },
      {
        type: "checkbox",
        id: "fullscreen",
        label: "Fullscreen",
        checked: props.isFullscreen,
        onToggle: () => props.onToggleFullscreen(),
      },
    ],
  };
}

function buildArrangeMenu(props: MenuBarProps): MenuDefinition {
  const flow = props.flowRef.current;
  const disabled = props.readonly || !(flow?.hasSelection() ?? false);
  return {
    id: "arrange",
    label: "Arrange",
    items: [
      {
        type: "action",
        id: "bring-to-front",
        label: "Bring to Front",
        disabled,
        onSelect: () => flow?.bringSelectedToFront(),
      },
      {
        type: "action",
        id: "send-to-back",
        label: "Send to Back",
        disabled,
        onSelect: () => flow?.sendSelectedToBack(),
      },
      { type: "separator", id: "arrange-sep-1" },
      {
        type: "submenu",
        id: "align",
        label: "Align",
        disabled,
        items: [
          { type: "action", id: "align-left", label: "Left", disabled, onSelect: () => flow?.alignSelected("left") },
          { type: "action", id: "align-center", label: "Center", disabled, onSelect: () => flow?.alignSelected("center") },
          { type: "action", id: "align-right", label: "Right", disabled, onSelect: () => flow?.alignSelected("right") },
          { type: "action", id: "align-top", label: "Top", disabled, onSelect: () => flow?.alignSelected("top") },
          { type: "action", id: "align-middle", label: "Middle", disabled, onSelect: () => flow?.alignSelected("middle") },
          { type: "action", id: "align-bottom", label: "Bottom", disabled, onSelect: () => flow?.alignSelected("bottom") },
          { type: "separator", id: "align-sep" },
          {
            type: "action",
            id: "distribute-horizontal",
            label: "Distribute Horizontally",
            disabled,
            onSelect: () => flow?.distributeSelected("horizontal"),
          },
          {
            type: "action",
            id: "distribute-vertical",
            label: "Distribute Vertically",
            disabled,
            onSelect: () => flow?.distributeSelected("vertical"),
          },
        ],
      },
      { type: "action", id: "group", label: "Group", disabled, onSelect: () => flow?.groupSelected() },
      { type: "action", id: "ungroup", label: "Ungroup", disabled, onSelect: () => flow?.ungroupSelected() },
      { type: "separator", id: "arrange-sep-2" },
      {
        type: "submenu",
        id: "rotate",
        label: "Rotate",
        disabled,
        items: [
          {
            type: "action",
            id: "rotate-90",
            label: "Rotate 90°",
            disabled,
            onSelect: () => flow?.rotateSelected(90),
          },
          {
            type: "action",
            id: "rotate-neg90",
            label: "Rotate -90°",
            disabled,
            onSelect: () => flow?.rotateSelected(-90),
          },
        ],
      },
      {
        type: "submenu",
        id: "flip",
        label: "Flip",
        disabled,
        items: [
          {
            type: "action",
            id: "flip-horizontal",
            label: "Flip Horizontal",
            disabled,
            onSelect: () => flow?.flipSelected("horizontal"),
          },
          {
            type: "action",
            id: "flip-vertical",
            label: "Flip Vertical",
            disabled,
            onSelect: () => flow?.flipSelected("vertical"),
          },
        ],
      },
      {
        type: "checkbox",
        id: "lock",
        label: "Lock",
        checked: flow?.isSelectionLocked() ?? false,
        disabled,
        onToggle: (checked) => (checked ? flow?.lockSelected() : flow?.unlockSelected()),
      },
    ],
  };
}

/**
 * Top-level menu bar (File/Edit/View/Arrange), built on the shared Menu
 * primitive rather than a bespoke dropdown implementation. Menu item state
 * (undo/redo availability, grid visibility) is read fresh on every render
 * from `flowRef.current` and `gridVisible`, since the underlying
 * FlowBuilderRef methods are plain imperative calls, not reactive state.
 */
export const MenuBar: FC<MenuBarProps> = (props) => {
  return (
    <div className="wec-flow-menu-bar" role="menubar" aria-label="Flow editor menu">
      <Menu menu={buildFileMenu(props)} />
      <Menu menu={buildEditMenu(props)} />
      <Menu menu={buildViewMenu(props)} />
      <Menu menu={buildArrangeMenu(props)} />
      <div className="wec-flow-menu-bar__trailing">
        <Tooltip label="Validate flow" placement="bottom">
          <button
            type="button"
            className="wec-flow-menu-bar__action"
            aria-label="Validate flow"
            onClick={props.onValidate}
          >
            <Icon name="check" />
          </button>
        </Tooltip>
        <Tooltip label={props.readonly ? "Disable read-only" : "Enable read-only"} placement="bottom">
          <button
            type="button"
            className={[
              "wec-flow-menu-bar__action",
              props.readonly ? "wec-flow-menu-bar__action--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label="Toggle read-only mode"
            aria-pressed={props.readonly}
            onClick={() => props.onToggleReadonly(!props.readonly)}
          >
            <Icon name={props.readonly ? "eyeOff" : "eye"} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

export default MenuBar;

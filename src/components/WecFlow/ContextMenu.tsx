import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useFlowEngine } from "../../context/FlowContext";
import type { XYPosition } from "../../types/flowchart.types";
import type { FlowEngine } from "../../utils/flowchart/flowEngine";
import type { AlignMode, DistributeAxis } from "../../utils/flowchart/alignment";
import { cx } from "../../utils/flowchart/shallow";
import { Icon, NodeIcon, type IconName } from "./FlowIcons";
import { lineStyleOptions } from "./lineStyles";

export type ContextMenuTarget =
  { kind: "canvas" } | { kind: "node"; id: string } | { kind: "edge"; id: string };

export interface ContextMenuRequest {
  target: ContextMenuTarget;
  screen: XYPosition;
  flow: XYPosition;
}

interface MenuAction {
  label: string;
  icon: IconName;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  run: () => void;
}

interface MenuSection {
  title?: string;
  actions: MenuAction[];
  addNodesAt?: XYPosition;
  insertOnEdge?: { edgeId: string; at: XYPosition };
}

const MENU_MARGIN = 8;

const alignActions: { mode: AlignMode; label: string; icon: IconName }[] = [
  { mode: "left", label: "Align left", icon: "alignLeft" },
  { mode: "center", label: "Align center", icon: "alignCenter" },
  { mode: "right", label: "Align right", icon: "alignRight" },
  { mode: "top", label: "Align top", icon: "alignTop" },
  { mode: "middle", label: "Align middle", icon: "alignMiddle" },
  { mode: "bottom", label: "Align bottom", icon: "alignBottom" },
];

const distributeActions: { axis: DistributeAxis; label: string; icon: IconName }[] = [
  { axis: "horizontal", label: "Distribute horizontally", icon: "distributeH" },
  { axis: "vertical", label: "Distribute vertically", icon: "distributeV" },
];

function canvasSections(engine: FlowEngine, flow: XYPosition, readOnly: boolean): MenuSection[] {
  const view: MenuSection = {
    actions: [
      { label: "Select all", icon: "select", shortcut: "Ctrl A", run: () => engine.selectAll() },
      { label: "Fit view", icon: "fit", shortcut: "F", run: () => engine.fitView() },
      { label: "Zoom to 100%", icon: "search", shortcut: "1", run: () => engine.zoomTo(1) },
    ],
  };
  if (readOnly) return [view];
  const add: MenuSection = { title: "Add node here", actions: [], addNodesAt: flow };
  const edit: MenuSection = {
    actions: [
      {
        label: "Paste",
        icon: "paste",
        shortcut: "Ctrl V",
        disabled: !engine.hasClipboard(),
        run: () => engine.paste(flow),
      },
    ],
  };
  return [add, edit, view];
}

function nodeSections(engine: FlowEngine, readOnly: boolean): MenuSection[] {
  const count = engine.getState().selectedNodeIds.size;
  const clipboard: MenuSection = {
    actions: [
      { label: "Copy", icon: "copy", shortcut: "Ctrl C", run: () => engine.copySelection() },
    ],
  };
  if (readOnly) return [clipboard];
  clipboard.actions.push(
    { label: "Cut", icon: "cut", shortcut: "Ctrl X", run: () => engine.cutSelection() },
    {
      label: "Duplicate",
      icon: "plus",
      shortcut: "Ctrl D",
      run: () => engine.duplicateNodes([...engine.getState().selectedNodeIds]),
    },
  );
  const sections = [clipboard];
  if (count >= 2) {
    sections.push({
      title: "Align",
      actions: alignActions.map((a) => ({
        label: a.label,
        icon: a.icon,
        run: () => engine.alignSelection(a.mode),
      })),
    });
  }
  if (count >= 3) {
    sections.push({
      title: "Distribute",
      actions: distributeActions.map((d) => ({
        label: d.label,
        icon: d.icon,
        run: () => engine.distributeSelection(d.axis),
      })),
    });
  }
  sections.push({
    actions: [
      {
        label: count > 1 ? `Delete ${count} nodes` : "Delete",
        icon: "trash",
        shortcut: "Del",
        danger: true,
        run: () => engine.deleteSelection(),
      },
    ],
  });
  return sections;
}

function edgeSections(
  engine: FlowEngine,
  id: string,
  at: XYPosition,
  readOnly: boolean,
): MenuSection[] {
  const s = engine.getState();
  const edge = s.edgeLookup.get(id);
  if (readOnly || !edge) return [];
  const current = edge.type ?? s.defaultEdgeType;
  const style: MenuSection = {
    title: "Line style",
    actions: lineStyleOptions.map((l) => ({
      label: current === l.value ? `${l.label} (current)` : l.label,
      icon: l.icon,
      disabled: current === l.value,
      run: () => engine.updateEdge(id, { type: l.value }),
    })),
  };
  const edit: MenuSection = {
    actions: [
      { label: "Reverse direction", icon: "redo", run: () => engine.reverseEdge(id) },
      {
        label: edge.animated ? "Stop animation" : "Animate flow",
        icon: "flow",
        run: () => engine.updateEdge(id, { animated: !edge.animated }),
      },
      ...(edge.bend === undefined
        ? []
        : [
            {
              label: "Reset route",
              icon: "fit" as const,
              run: () => engine.setEdgeBend(id, undefined),
            },
          ]),
    ],
  };
  const insert: MenuSection = {
    title: "Insert node here",
    actions: [],
    insertOnEdge: { edgeId: id, at },
  };
  const remove: MenuSection = {
    actions: [
      {
        label: "Delete connection",
        icon: "trash",
        shortcut: "Del",
        danger: true,
        run: () => engine.removeEdges([id]),
      },
    ],
  };
  return [style, edit, insert, remove];
}

function sectionsFor(engine: FlowEngine, request: ContextMenuRequest): MenuSection[] {
  const readOnly = engine.getState().readOnly;
  if (request.target.kind === "node") return nodeSections(engine, readOnly);
  if (request.target.kind === "edge")
    return edgeSections(engine, request.target.id, request.flow, readOnly);
  return canvasSections(engine, request.flow, readOnly);
}

function NodeTypeList({ engine, onPick }: { engine: FlowEngine; onPick: (type: string) => void }) {
  return (
    <>
      {engine.registry.list().map((def) => (
        <button
          key={def.type}
          type="button"
          role="menuitem"
          className="wpn-flowchart-menu__item"
          style={{ "--node-color": def.color } as CSSProperties}
          onClick={() => onPick(def.type)}
        >
          <span className="wpn-flowchart-menu__node-icon">
            <NodeIcon icon={def.icon} size={13} />
          </span>
          <span className="wpn-flowchart-menu__label">{def.label}</span>
        </button>
      ))}
    </>
  );
}

function addNodeAt(engine: FlowEngine, type: string, at: XYPosition | undefined, done: () => void) {
  if (!at) return;
  const def = engine.getDefinition(type);
  const node = engine.addNode({
    type,
    position: engine.snap({
      x: at.x - def.defaultSize.width / 2,
      y: at.y - def.defaultSize.height / 2,
    }),
  });
  engine.selectNode(node.id);
  done();
}

function insertOnEdge(
  engine: FlowEngine,
  type: string,
  target: MenuSection["insertOnEdge"],
  done: () => void,
) {
  if (!target) return;
  engine.insertNodeOnEdge(target.edgeId, type, target.at);
  done();
}

export const ContextMenu = memo(function ContextMenu({
  request,
  onClose,
}: {
  request: ContextMenuRequest;
  onClose: () => void;
}) {
  const engine = useFlowEngine();
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(request.screen);
  const sections = sectionsFor(engine, request).filter(
    (s) => s.actions.length > 0 || s.addNodesAt || s.insertOnEdge,
  );

  useLayoutEffect(() => {
    const menu = ref.current;
    const parent = menu?.offsetParent;
    if (!menu || !(parent instanceof HTMLElement)) return;
    setPosition({
      x: Math.max(
        MENU_MARGIN,
        Math.min(request.screen.x, parent.clientWidth - menu.offsetWidth - MENU_MARGIN),
      ),
      y: Math.max(
        MENU_MARGIN,
        Math.min(request.screen.y, parent.clientHeight - menu.offsetHeight - MENU_MARGIN),
      ),
    });
  }, [request.screen]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!(e.target instanceof Node) || !ref.current?.contains(e.target)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  if (sections.length === 0) return null;

  return (
    <div
      ref={ref}
      className="wpn-flowchart-menu__menu"
      role="menu"
      style={{ left: position.x, top: position.y }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {sections.map((section, index) => (
        <div key={section.title ?? index} className="wpn-flowchart-menu__section">
          {section.title && <div className="wpn-flowchart-menu__title">{section.title}</div>}
          {section.addNodesAt && (
            <NodeTypeList
              engine={engine}
              onPick={(type) => addNodeAt(engine, type, section.addNodesAt, onClose)}
            />
          )}
          {section.insertOnEdge && (
            <NodeTypeList
              engine={engine}
              onPick={(type) => insertOnEdge(engine, type, section.insertOnEdge, onClose)}
            />
          )}
          {section.actions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              className={cx(
                "wpn-flowchart-menu__item",
                action.danger && "wpn-flowchart-menu__danger",
              )}
              disabled={action.disabled}
              onClick={() => {
                action.run();
                onClose();
              }}
            >
              <Icon name={action.icon} size={14} />
              <span className="wpn-flowchart-menu__label">{action.label}</span>
              {action.shortcut && (
                <kbd className="wpn-flowchart-menu__shortcut">{action.shortcut}</kbd>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
});

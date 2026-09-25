import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import { useFlowEngine } from "../../context/FlowContext";
import type { HandleSide } from "../../types/flowchart.types";
import type { NodeTypeDefinition } from "../../utils/flowchart/nodeTypes";
import { cx } from "../../utils/flowchart/shallow";
import { Icon, NodeIcon } from "./FlowIcons";

const QUICK_ADD_OFFSET = 30;

const buttonPosition: Record<HandleSide, (w: number, h: number) => CSSProperties> = {
  top: (w) => ({ left: w / 2, top: -QUICK_ADD_OFFSET }),
  bottom: (w, h) => ({ left: w / 2, top: h + QUICK_ADD_OFFSET }),
  left: (_w, h) => ({ left: -QUICK_ADD_OFFSET, top: h / 2 }),
  right: (w, h) => ({ left: w + QUICK_ADD_OFFSET, top: h / 2 }),
};

function outgoingSides(def: NodeTypeDefinition): HandleSide[] {
  return [...new Set(def.handles.filter((h) => h.kind === "source").map((h) => h.side))];
}

function TypePicker({
  side,
  onPick,
  onClose,
}: {
  side: HandleSide;
  onPick: (type: string) => void;
  onClose: () => void;
}) {
  const engine = useFlowEngine();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = engine.registry
    .list()
    .filter(
      (def) =>
        q === "" ||
        def.label.toLowerCase().includes(q) ||
        (def.description ?? "").toLowerCase().includes(q),
    );
  const [first] = matches;

  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Escape") onClose();
    if (e.key === "Enter" && first) onPick(first.type);
  };

  return (
    <div
      className={cx("wpn-flowchart-node__quick-picker", `wpn-flowchart-node__quick-picker-${side}`)}
      role="menu"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="wpn-flowchart-node__quick-search">
        <Icon name="search" size={12} />
        <input
          autoFocus
          className="wpn-flowchart-node__quick-search-input"
          placeholder="Search nodes…"
          aria-label="Search node types"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKeyDown}
        />
      </div>
      {matches.map((def) => (
        <button
          key={def.type}
          type="button"
          role="menuitem"
          className="wpn-flowchart-node__quick-picker-item"
          style={{ "--node-color": def.color } as CSSProperties}
          onClick={() => onPick(def.type)}
        >
          <span className="wpn-flowchart-node__quick-picker-icon">
            <NodeIcon icon={def.icon} size={12} />
          </span>
          {def.label}
        </button>
      ))}
      {matches.length === 0 && (
        <div className="wpn-flowchart-node__quick-empty">No matching nodes</div>
      )}
    </div>
  );
}

/** "+" buttons around a node that add and connect a new node on that side. */
export const QuickAdd = memo(function QuickAdd({
  nodeId,
  definition,
  width,
  height,
}: {
  nodeId: string;
  definition: NodeTypeDefinition;
  width: number;
  height: number;
}) {
  const engine = useFlowEngine();
  const [openSide, setOpenSide] = useState<HandleSide | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openSide) return;
    const close = (e: PointerEvent) => {
      if (!(e.target instanceof Node) || !pickerRef.current?.contains(e.target)) setOpenSide(null);
    };
    window.addEventListener("pointerdown", close, true);
    return () => window.removeEventListener("pointerdown", close, true);
  }, [openSide]);

  const add = (side: HandleSide, type: string) => {
    setOpenSide(null);
    engine.addConnectedNode(nodeId, side, type);
  };

  return (
    <>
      {outgoingSides(definition).map((side) => (
        <div
          key={side}
          className={cx(
            "wpn-flowchart-node__quick-add",
            openSide === side && "wpn-flowchart-node__quick-add-open",
          )}
          style={buttonPosition[side](width, height)}
        >
          <button
            type="button"
            className="wpn-flowchart-node__quick-add-button"
            title="Add a connected node (Shift-click adds a Process)"
            aria-label={`Add connected node ${side}`}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onClick={(e) => {
              if (e.shiftKey) add(side, "process");
              else setOpenSide((current) => (current === side ? null : side));
            }}
          >
            <Icon name="plus" size={11} />
          </button>
          {openSide === side && (
            <div ref={pickerRef}>
              <TypePicker
                side={side}
                onPick={(type) => add(side, type)}
                onClose={() => setOpenSide(null)}
              />
            </div>
          )}
        </div>
      ))}
    </>
  );
});

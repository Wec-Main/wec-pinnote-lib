import { Icon, Tooltip } from "../primitives";

interface FlowPinPinProps {
  name: string;
  x: number;
  y: number;
  resolvedTarget: boolean;
  active: boolean;
  onSelect: () => void;
}

export function FlowPinPin({ name, x, y, resolvedTarget, active, onSelect }: FlowPinPinProps) {
  return (
    <Tooltip label={name} placement="bottom">
      <button
        type="button"
        className={[
          "wpn-flow-pin",
          resolvedTarget ? "" : "wpn-flow-pin--orphaned",
          active ? "wpn-flow-pin--active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-expanded={active}
        style={{ left: x, top: y }}
        aria-label={`Open flow: ${name}`}
        onClick={onSelect}
      >
        <Icon name="flow" />
        <span className="wpn-flow-pin__label">{name}</span>
      </button>
    </Tooltip>
  );
}

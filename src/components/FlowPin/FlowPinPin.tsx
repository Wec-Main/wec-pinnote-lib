import { Icon, Tooltip } from "../primitives";

interface FlowPinPinProps {
  name: string;
  x: number;
  y: number;
  resolvedTarget: boolean;
  onSelect: () => void;
}

export function FlowPinPin({ name, x, y, resolvedTarget, onSelect }: FlowPinPinProps) {
  return (
    <Tooltip label={name} placement="bottom">
      <button
        type="button"
        className={["wpn-flow-pin", resolvedTarget ? "" : "wpn-flow-pin--orphaned"].filter(Boolean).join(" ")}
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

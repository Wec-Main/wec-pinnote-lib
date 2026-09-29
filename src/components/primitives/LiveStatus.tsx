import type { StreamConnectionState } from "../../types/stream.types";
import { Tooltip } from "./Tooltip";

interface LiveStatusAppearance {
  label: string;
  tone: "open" | "reconnecting" | "unauthenticated";
}

const LIVE_STATUS: Partial<Record<StreamConnectionState, LiveStatusAppearance>> = {
  open: { label: "Live updates on", tone: "open" },
  connecting: { label: "Connecting to live updates", tone: "reconnecting" },
  reconnecting: { label: "Reconnecting to live updates", tone: "reconnecting" },
  unauthenticated: { label: "Live updates paused, sign in again", tone: "unauthenticated" },
};

export function LiveStatus({ state }: { state: StreamConnectionState }) {
  const status = LIVE_STATUS[state];
  if (!status) {
    return null;
  }
  return (
    <Tooltip label={status.label} placement="bottom">
      <span
        className={`wpn-toolbar__live wpn-toolbar__live--${status.tone}`}
        role="status"
        aria-label={status.label}
      >
        <span className="wpn-toolbar__live-dot" />
      </span>
    </Tooltip>
  );
}

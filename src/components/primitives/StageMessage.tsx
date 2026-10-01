import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

interface StageMessageProps {
  icon: IconName;
  message: string;
  action?: ReactNode;
}

export function StageMessage({ icon, message, action }: StageMessageProps) {
  return (
    <div className="wpn-flow-message" role={icon === "alert" ? "alert" : undefined}>
      <span className={`wpn-flow-message__icon wpn-flow-message__icon--${icon}`}>
        <Icon name={icon} />
      </span>
      <p className="wpn-flow-message__text">{message}</p>
      {action}
    </div>
  );
}

import { Icon, type IconName } from "../../primitives";

export type WidgetMessageTone = "empty" | "error";

export interface WidgetMessageProps {
  tone: WidgetMessageTone;
  icon: IconName;
  title: string;
  detail?: string;
}

export interface WidgetMessageRowProps extends WidgetMessageProps {
  colSpan: number;
}

const TONE_CLASS: Record<WidgetMessageTone, string> = {
  empty: "wpn-dashboard-message--empty",
  error: "wpn-dashboard-message--error",
};

export function WidgetMessage({ tone, icon, title, detail }: WidgetMessageProps) {
  return (
    <div
      className={["wpn-dashboard-message", TONE_CLASS[tone]].join(" ")}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon name={icon} className="wpn-dashboard-message__icon" />
      <span className="wpn-dashboard-message__title">{title}</span>
      {detail ? <span className="wpn-dashboard-message__detail">{detail}</span> : null}
    </div>
  );
}

export function WidgetMessageRow({ colSpan, ...message }: WidgetMessageRowProps) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <WidgetMessage {...message} />
      </td>
    </tr>
  );
}

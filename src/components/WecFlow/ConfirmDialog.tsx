import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "../../utils/flowchart/shallow";
import { Icon, type IconName } from "./FlowIcons";

export interface ConfirmDialogProps {
  title: string;
  icon: IconName;
  confirmLabel: string;
  busy?: boolean;
  warning?: string;
  children: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  icon,
  confirmLabel,
  busy = false,
  warning,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Escape" && !busy) onCancel();
  };

  return (
    <div
      className="wpn-flowchart-confirm__scrim"
      onPointerDown={() => !busy && onCancel()}
      onKeyDown={onKeyDown}
    >
      <div
        className="wpn-flowchart-confirm__dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="wpn-flowchart-confirm__header">
          <span className="wpn-flowchart-confirm__icon">
            <Icon name={icon} size={16} />
          </span>
          <h2 id={titleId} className="wpn-flowchart-confirm__title">
            {title}
          </h2>
        </div>
        <div className="wpn-flowchart-confirm__body">
          {children}
          {warning && (
            <p className="wpn-flowchart-confirm__warning">
              <Icon name="alert" size={13} />
              {warning}
            </p>
          )}
        </div>
        <div className="wpn-flowchart-confirm__footer">
          <button
            type="button"
            className={cx("wpn-flowchart-ui__btn", "wpn-flowchart-ui__btn-ghost")}
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={cx("wpn-flowchart-ui__btn", "wpn-flowchart-ui__btn-primary")}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

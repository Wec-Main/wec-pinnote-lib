import { useCallback, useId, useRef, type ReactNode } from "react";
import { Icon, Spinner, type IconName } from "../primitives";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useScrimDismiss } from "../../hooks/useScrimDismiss";
import { useFocusTrap } from "../../hooks/useFocusTrap";

interface ConfirmDialogProps {
  title: string;
  description: string;
  detail?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  confirmIcon?: IconName;
  destructive?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  title,
  description,
  detail,
  confirmLabel,
  cancelLabel = "Cancel",
  confirmIcon,
  destructive = false,
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const dismiss = useCallback(() => {
    if (!busy) {
      onCancel();
    }
  }, [busy, onCancel]);

  useEscapeKey(dismiss);
  const scrimProps = useScrimDismiss(dismiss);
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(dialogRef, confirmRef);

  return (
    <div className="wpn-epicflow-modal-scrim" {...scrimProps}>
      <div
        ref={dialogRef}
        className={[
          "wpn-confirm",
          destructive ? "wpn-confirm--destructive" : "wpn-confirm--neutral",
        ].join(" ")}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        aria-describedby={descriptionId}
      >
        <div className="wpn-confirm__body">
          <span className="wpn-confirm__icon" aria-hidden="true">
            <Icon name={destructive ? "alert" : (confirmIcon ?? "check")} />
          </span>
          <div className="wpn-confirm__copy">
            <h2 className="wpn-confirm__title">{title}</h2>
            <p className="wpn-confirm__description" id={descriptionId}>
              {description}
            </p>
            {detail ? <div className="wpn-confirm__detail">{detail}</div> : null}
          </div>
        </div>

        <div className="wpn-confirm__footer">
          <button
            type="button"
            className="wpn-btn wpn-btn--ghost"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={["wpn-btn", destructive ? "wpn-btn--danger" : "wpn-btn--primary"].join(" ")}
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? (
              <Spinner className="wpn-btn__icon" />
            ) : (
              <Icon
                name={confirmIcon ?? (destructive ? "trash" : "check")}
                className="wpn-btn__icon"
              />
            )}
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

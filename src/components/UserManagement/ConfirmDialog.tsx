import { Icon, Spinner, type IconName } from "../primitives";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useScrimDismiss } from "../../hooks/useScrimDismiss";

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  confirmIcon?: IconName;
  destructive?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  confirmIcon,
  destructive = false,
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  useEscapeKey(onCancel);
  const scrimProps = useScrimDismiss(onCancel);
  return (
    <div className="wpn-epicflow-modal-scrim" {...scrimProps}>
      <div
        className="wpn-epicflow-modal wpn-users-confirm"
        role="alertdialog"
        aria-label={title}
      >
        <div className="wpn-users-confirm__body">
          <h2 className="wpn-epicflow-modal__title">{title}</h2>
          <p className="wpn-epicflow-modal__subtitle">{description}</p>
        </div>
        <div className="wpn-epicflow-modal__footer">
          <button
            type="button"
            className="wpn-btn wpn-btn--ghost"
            onClick={onCancel}
            disabled={busy}
          >
            <Icon name="close" className="wpn-btn__icon" />
            Cancel
          </button>
          <button
            type="button"
            className={[
              "wpn-btn",
              destructive ? "wpn-btn--danger" : "wpn-btn--primary",
            ].join(" ")}
            onClick={onConfirm}
            disabled={busy}
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

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, onCancel, onConfirm }: ConfirmDialogProps) {
  return (
    <div className="wpn-epicflow-modal-scrim" onClick={onCancel}>
      <div className="wpn-epicflow-confirm" onClick={(event) => event.stopPropagation()}>
        <div className="wpn-epicflow-confirm__body">
          <h2 className="wpn-epicflow-confirm__title">{title}</h2>
          <p className="wpn-epicflow-confirm__message">{message}</p>
        </div>
        <div className="wpn-epicflow-confirm__footer">
          <button type="button" className="wpn-btn wpn-btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="wpn-btn wpn-btn--danger" onClick={onConfirm}>
            {confirmLabel ?? "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

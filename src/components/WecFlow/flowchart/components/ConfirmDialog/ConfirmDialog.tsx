import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cx } from '../../utils/shallow';
import { Icon, type IconName } from '../icons';
import ui from '../ui/ui.module.css';
import styles from './ConfirmDialog.module.css';

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

export function ConfirmDialog({ title, icon, confirmLabel, busy = false, warning, children, onConfirm, onCancel }: ConfirmDialogProps) {
  const titleId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape' && !busy) onCancel();
  };

  return (
    <div className={styles.scrim} onPointerDown={() => !busy && onCancel()} onKeyDown={onKeyDown}>
      <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby={titleId} onPointerDown={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.icon}>
            <Icon name={icon} size={16} />
          </span>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
        </div>
        <div className={styles.body}>
          {children}
          {warning && (
            <p className={styles.warning}>
              <Icon name="alert" size={13} />
              {warning}
            </p>
          )}
        </div>
        <div className={styles.footer}>
          <button type="button" className={cx(ui.btn, ui.btnGhost)} disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button ref={confirmRef} type="button" className={cx(ui.btn, ui.btnPrimary)} disabled={busy} onClick={onConfirm}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

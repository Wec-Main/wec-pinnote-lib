import { memo } from 'react';
import { useFlowEngine, useFlowState } from '../../hooks/FlowContext';
import { cx } from '../../utils/shallow';
import { Icon } from '../icons';
import styles from './FlowCanvas.module.css';

export type CanvasMode = 'pan' | 'select';

interface Props {
  mode: CanvasMode;
  onModeChange: (mode: CanvasMode) => void;
}

/** Floating zoom / fit / mode controls. */
export const Controls = memo(function Controls({ mode, onModeChange }: Props) {
  const engine = useFlowEngine();
  const zoom = useFlowState((s) => Math.round(s.viewport.zoom * 100));
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  return (
    <div className={styles.controls} onPointerDown={stop}>
      <div className={styles.controlGroup}>
        <button type="button" className={cx(styles.controlBtn, mode === 'pan' && styles.controlActive)} title="Pan mode (drag to move the canvas)" onClick={() => onModeChange('pan')}>
          <Icon name="hand" />
        </button>
        <button type="button" className={cx(styles.controlBtn, mode === 'select' && styles.controlActive)} title="Selection mode (drag to select, or hold Shift)" onClick={() => onModeChange('select')}>
          <Icon name="select" />
        </button>
      </div>
      <div className={styles.controlGroup}>
        <button type="button" className={styles.controlBtn} title="Zoom out" onClick={engine.zoomOut}>
          <Icon name="minus" />
        </button>
        <button type="button" className={styles.zoomValue} title="Reset zoom to 100%" onClick={() => engine.zoomAt(1 / engine.getState().viewport.zoom)}>
          {zoom}%
        </button>
        <button type="button" className={styles.controlBtn} title="Zoom in" onClick={engine.zoomIn}>
          <Icon name="plus" />
        </button>
        <button type="button" className={styles.controlBtn} title="Fit view" onClick={() => engine.fitView()}>
          <Icon name="fit" />
        </button>
      </div>
    </div>
  );
});

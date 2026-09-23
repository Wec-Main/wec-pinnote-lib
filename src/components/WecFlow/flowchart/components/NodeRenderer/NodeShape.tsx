import { memo } from 'react';
import type { NodeShape as Shape } from '../../models/NodeTypes';
import { parallelogramSkew } from '../../utils/geometry';
import styles from './NodeRenderer.module.css';

interface Props {
  shape: Shape;
  width: number;
  height: number;
}

/** SVG outline behind a node's content. Styling (fill/stroke/state) comes from CSS. */
export const NodeShape = memo(function NodeShape({ shape, width: w, height: h }: Props) {
  let el;
  switch (shape) {
    case 'diamond':
      el = <polygon points={`${w / 2},1 ${w - 1},${h / 2} ${w / 2},${h - 1} 1,${h / 2}`} />;
      break;
    case 'parallelogram': {
      const s = parallelogramSkew(w);
      el = <polygon points={`${s},1 ${w - 1},1 ${w - s},${h - 1} 1,${h - 1}`} />;
      break;
    }
    default: {
      const rx = shape === 'pill' ? h / 2 : shape === 'rounded' ? 12 : 4;
      el = <rect x={1} y={1} width={Math.max(0, w - 2)} height={Math.max(0, h - 2)} rx={rx} />;
    }
  }
  return (
    <svg className={styles.shape} width={w} height={h} aria-hidden="true">
      {el}
    </svg>
  );
});

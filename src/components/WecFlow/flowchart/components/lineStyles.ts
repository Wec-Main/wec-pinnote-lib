import type { EdgePathType } from '../models/FlowTypes';
import type { IconName } from './icons';

export interface LineStyleOption {
  value: EdgePathType;
  label: string;
  icon: IconName;
}

export const lineStyleOptions: LineStyleOption[] = [
  { value: 'step', label: 'Step', icon: 'lineStep' },
  { value: 'bezier', label: 'Curved', icon: 'curve' },
  { value: 'straight', label: 'Straight', icon: 'lineStraight' },
];

import type { EdgePathType } from "../../types/flowchart.types";
import type { IconName } from "./FlowIcons";

export interface LineStyleOption {
  value: EdgePathType;
  label: string;
  icon: IconName;
}

export const lineStyleOptions: LineStyleOption[] = [
  { value: "step", label: "Step", icon: "lineStep" },
  { value: "bezier", label: "Curved", icon: "curve" },
  { value: "straight", label: "Straight", icon: "lineStraight" },
];

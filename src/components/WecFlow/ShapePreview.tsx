import type { ReactNode } from "react";
import type { NodeShape } from "../../utils/flowchart/nodeTypes";

const W = 44;
const H = 30;

const previews: Partial<Record<NodeShape, ReactNode>> = {
  rectangle: <rect x={4} y={7} width={36} height={16} rx={1.5} />,
  rounded: <rect x={4} y={7} width={36} height={16} rx={6} />,
  square: <rect x={11.5} y={4} width={21} height={21} rx={1.5} />,
  circle: <circle cx={22} cy={15} r={11} />,
  ellipse: <ellipse cx={22} cy={15} rx={18} ry={9.5} />,
  triangle: <polygon points="22,3.5 35.5,26 8.5,26" />,
  hexagon: <polygon points="11,5 33,5 40,15 33,25 11,25 4,15" />,
  cylinder: (
    <>
      <path d="M10,7.5 A12,3.8 0 0 1 34,7.5 V22.5 A12,3.8 0 0 1 10,22.5 Z" />
      <path className="wpn-flowchart-shape-preview__line" d="M10,7.5 A12,3.8 0 0 0 34,7.5" />
    </>
  ),
  text: (
    <text className="wpn-flowchart-shape-preview__text" x={22} y={19.5} textAnchor="middle">
      Text
    </text>
  ),
  actor: (
    <>
      <circle cx={22} cy={8.5} r={5} />
      <path d="M12,26.5 C12,15.5 32,15.5 32,26.5 Z" />
    </>
  ),
  swimlane: (
    <>
      <rect x={3} y={4} width={38} height={22} rx={1.5} />
      <path className="wpn-flowchart-shape-preview__line" d="M10,15 H41" />
      <rect
        className="wpn-flowchart-shape-preview__band"
        x={3}
        y={4}
        width={7}
        height={22}
        rx={1.5}
      />
    </>
  ),
  swimlaneVertical: (
    <>
      <rect x={9} y={2} width={26} height={26} rx={1.5} />
      <path className="wpn-flowchart-shape-preview__line" d="M22,8 V28" />
      <rect
        className="wpn-flowchart-shape-preview__band"
        x={9}
        y={2}
        width={26}
        height={6}
        rx={1.5}
      />
    </>
  ),
};

export function hasShapePreview(shape: NodeShape): boolean {
  return shape in previews;
}

export function ShapePreview({ shape }: { shape: NodeShape }) {
  return (
    <svg
      className="wpn-flowchart-shape-preview"
      width={48}
      height={33}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden="true"
    >
      {previews[shape]}
    </svg>
  );
}

import { memo } from "react";
import type { NodeShape as Shape } from "../../../utils/flowchart/nodeTypes";
import { parallelogramSkew } from "../../../utils/flowchart/geometry";

export const LANE_HEADER_SIZE = 32;

interface Props {
  shape: Shape;
  width: number;
  height: number;
  radius?: number;
}

export const NodeShape = memo(function NodeShape({ shape, width: w, height: h, radius }: Props) {
  let el;
  switch (shape) {
    case "diamond":
      el = <polygon points={`${w / 2},1 ${w - 1},${h / 2} ${w / 2},${h - 1} 1,${h / 2}`} />;
      break;
    case "parallelogram": {
      const s = parallelogramSkew(w);
      el = <polygon points={`${s},1 ${w - 1},1 ${w - s},${h - 1} 1,${h - 1}`} />;
      break;
    }
    case "subprocess": {
      const inset = Math.min(14, w / 8);
      el = (
        <g>
          <rect x={1} y={1} width={Math.max(0, w - 2)} height={Math.max(0, h - 2)} rx={4} />
          <line x1={inset} y1={1} x2={inset} y2={h - 1} />
          <line x1={w - inset} y1={1} x2={w - inset} y2={h - 1} />
        </g>
      );
      break;
    }
    case "circle":
    case "ellipse":
      el = (
        <ellipse cx={w / 2} cy={h / 2} rx={Math.max(0, w / 2 - 1)} ry={Math.max(0, h / 2 - 1)} />
      );
      break;
    case "triangle":
      el = <polygon points={`${w / 2},1 ${w - 1},${h - 1} 1,${h - 1}`} />;
      break;
    case "hexagon": {
      const cut = Math.min(24, w / 4);
      el = (
        <polygon
          points={`${cut},1 ${w - cut},1 ${w - 1},${h / 2} ${w - cut},${h - 1} ${cut},${h - 1} 1,${h / 2}`}
        />
      );
      break;
    }
    case "cylinder": {
      const rim = Math.min(14, h / 4);
      el = (
        <g>
          <path
            d={`M1,${rim} C1,${rim * 0.4} ${w - 1},${rim * 0.4} ${w - 1},${rim} L${w - 1},${h - rim} C${w - 1},${h - rim * 0.4} 1,${h - rim * 0.4} 1,${h - rim} Z`}
          />
          <path d={`M1,${rim} C1,${rim * 1.6} ${w - 1},${rim * 1.6} ${w - 1},${rim}`} />
        </g>
      );
      break;
    }
    case "cloud": {
      const rx = Math.max(1, w * 0.28);
      const ry = Math.max(1, h * 0.32);
      el = (
        <g>
          <ellipse cx={w * 0.32} cy={h * 0.6} rx={rx * 0.75} ry={ry * 0.75} />
          <ellipse cx={w * 0.68} cy={h * 0.55} rx={rx * 0.85} ry={ry * 0.85} />
          <ellipse cx={w * 0.5} cy={h * 0.4} rx={rx} ry={ry} />
          <rect x={w * 0.15} y={h * 0.45} width={w * 0.7} height={h * 0.45} />
        </g>
      );
      break;
    }
    case "actor": {
      const fh = Math.max(24, h - 26);
      const cx = w / 2;
      const head = Math.min(fh * 0.22, w * 0.24);
      const headCy = head + 2;
      const bodyTop = headCy + head + Math.max(3, fh * 0.05);
      const half = Math.min(w / 2 - 2, head * 1.9);
      el = (
        <g className="wpn-flowchart-node__actor">
          <circle cx={cx} cy={headCy} r={head} />
          <path
            d={`M${cx - half},${fh - 1} C${cx - half},${bodyTop} ${cx + half},${bodyTop} ${cx + half},${fh - 1} Z`}
          />
        </g>
      );
      break;
    }
    case "swimlane":
    case "swimlaneVertical": {
      const band = LANE_HEADER_SIZE;
      const vertical = shape === "swimlaneVertical";
      el = (
        <g>
          <rect x={1} y={1} width={Math.max(0, w - 2)} height={Math.max(0, h - 2)} rx={6} />
          <rect
            className="wpn-flowchart-node__lane-header"
            x={1}
            y={1}
            width={vertical ? Math.max(0, w - 2) : band}
            height={vertical ? band : Math.max(0, h - 2)}
            rx={6}
          />
        </g>
      );
      break;
    }
    case "text":
      el = null;
      break;
    default: {
      const rx =
        radius ??
        (shape === "pill" ? h / 2 : shape === "rounded" ? 12 : shape === "square" ? 0 : 4);
      el = <rect x={1} y={1} width={Math.max(0, w - 2)} height={Math.max(0, h - 2)} rx={rx} />;
    }
  }
  return (
    <svg className="wpn-flowchart-node__shape" width={w} height={h} aria-hidden="true">
      {el}
    </svg>
  );
});

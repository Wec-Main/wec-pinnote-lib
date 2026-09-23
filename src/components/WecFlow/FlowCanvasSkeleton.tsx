import { Spinner } from "../primitives";

const PALETTE_ITEMS = 7;

const SKELETON_NODES: ReadonlyArray<{
  x: number;
  y: number;
  width: number;
  height: number;
  shape: string;
}> = [
  { x: 50, y: 10, width: 150, height: 44, shape: "pill" },
  { x: 50, y: 30, width: 190, height: 60, shape: "box" },
  { x: 50, y: 52, width: 120, height: 84, shape: "diamond" },
  { x: 78, y: 52, width: 170, height: 56, shape: "box" },
  { x: 50, y: 78, width: 190, height: 60, shape: "box" },
  { x: 50, y: 94, width: 150, height: 44, shape: "pill" },
];

const SKELETON_LINKS: ReadonlyArray<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [2, 4],
  [4, 5],
];

export function FlowCanvasSkeleton() {
  return (
    <div className="wpn-flow-skeleton" aria-busy="true">
      <div className="wpn-flow-skeleton__toolbar">
        <span className="wpn-flow-skeleton__bar wpn-flow-skeleton__bar--title" />
        <span className="wpn-flow-skeleton__bar wpn-flow-skeleton__bar--tools" />
        <span className="wpn-flow-skeleton__bar wpn-flow-skeleton__bar--action" />
      </div>
      <div className="wpn-flow-skeleton__workspace">
        <div className="wpn-flow-skeleton__palette">
          {Array.from({ length: PALETTE_ITEMS }, (_, index) => (
            <span
              key={index}
              className="wpn-flow-skeleton__bar wpn-flow-skeleton__bar--palette"
              style={{ animationDelay: `${index * 70}ms` }}
            />
          ))}
        </div>
        <div className="wpn-flow-skeleton__canvas">
          <svg
            className="wpn-flow-skeleton__links"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {SKELETON_LINKS.map(([from, to], index) => {
              const source = SKELETON_NODES[from];
              const target = SKELETON_NODES[to];
              return source && target ? (
                <line
                  key={index}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  className="wpn-flow-skeleton__link"
                  vectorEffect="non-scaling-stroke"
                  style={{ animationDelay: `${150 + index * 110}ms` }}
                />
              ) : null;
            })}
          </svg>
          {SKELETON_NODES.map((node, index) => (
            <span
              key={index}
              className={`wpn-flow-skeleton__node wpn-flow-skeleton__node--${node.shape}`}
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                width: node.width,
                height: node.height,
                animationDelay: `${index * 110}ms`,
              }}
            />
          ))}
          <div className="wpn-flow-skeleton__label" role="status">
            <Spinner />
            <span>Loading flow…</span>
          </div>
        </div>
      </div>
    </div>
  );
}

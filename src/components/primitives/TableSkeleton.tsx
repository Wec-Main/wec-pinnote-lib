export type SkeletonCell = "identity" | "pill" | "text" | "actions";

interface TableSkeletonProps {
  rows: number;
  columns: SkeletonCell[];
  label: string;
}

function cellContent(cell: SkeletonCell) {
  if (cell === "identity") {
    return (
      <span className="wpn-skeleton-identity">
        <span className="wpn-skeleton wpn-skeleton--avatar" />
        <span className="wpn-skeleton-identity__copy">
          <span className="wpn-skeleton wpn-skeleton--line wpn-skeleton--name" />
          <span className="wpn-skeleton wpn-skeleton--line wpn-skeleton--sub" />
        </span>
      </span>
    );
  }
  if (cell === "pill") {
    return <span className="wpn-skeleton wpn-skeleton--pill" />;
  }
  if (cell === "actions") {
    return (
      <span className="wpn-skeleton-actions">
        <span className="wpn-skeleton wpn-skeleton--action" />
        <span className="wpn-skeleton wpn-skeleton--action" />
      </span>
    );
  }
  return <span className="wpn-skeleton wpn-skeleton--line" />;
}

export function TableSkeleton({ rows, columns, label }: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <tr key={rowIndex} className="wpn-skeleton-row" aria-hidden="true">
          {columns.map((cell, cellIndex) => (
            <td key={cellIndex}>{cellContent(cell)}</td>
          ))}
        </tr>
      ))}
      <tr className="wpn-skeleton-status">
        <td colSpan={columns.length}>
          <span role="status">{label}</span>
        </td>
      </tr>
    </>
  );
}

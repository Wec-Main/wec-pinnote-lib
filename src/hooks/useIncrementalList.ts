import { useState } from "react";

export function useIncrementalList<T>(items: T[], pageSize: number, pinnedIndex = -1) {
  const [limit, setLimit] = useState(pageSize);
  const visibleCount = Math.min(items.length, Math.max(limit, pinnedIndex + 1));

  return {
    visible: items.slice(0, visibleCount),
    remaining: items.length - visibleCount,
    showMore: () => setLimit(visibleCount + pageSize),
  };
}

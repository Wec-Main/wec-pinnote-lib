import { useState } from "react";

const DEFAULT_PAGE_SIZE = 10;

export function useClientPagination<T>(items: T[], initialPageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const lastPage = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, lastPage);

  return {
    pageItems: items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    paginationProps: {
      page: currentPage,
      pageSize,
      totalItems: items.length,
      onPageChange: setPage,
      onPageSizeChange: (next: number) => {
        setPageSize(next);
        setPage(1);
      },
    },
  };
}

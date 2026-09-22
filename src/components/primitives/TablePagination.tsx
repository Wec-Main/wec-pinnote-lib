import { Icon } from "./Icon";
import { SearchableSelect, type SelectOption } from "./SearchableSelect";
import { Tooltip } from "./Tooltip";

const PAGE_SIZE_OPTIONS: SelectOption[] = [
  { value: "5", label: "5" },
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
];

type PageSlot = number | "ellipsis-start" | "ellipsis-end";

function getVisiblePages(currentPage: number, totalPages: number): PageSlot[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis-end", totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [
      1,
      "ellipsis-start",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }
  return [
    1,
    "ellipsis-start",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "ellipsis-end",
    totalPages,
  ];
}

interface TablePaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function TablePagination({
  page,
  pageSize,
  totalItems,
  itemLabel,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);

  return (
    <div className="wpn-pagination">
      <div className="wpn-pagination__summary">
        {totalItems === 0 ? `No ${itemLabel}` : `${start}–${end} of ${totalItems} ${itemLabel}`}
      </div>

      <div className="wpn-pagination__nav">
        <Tooltip label="Previous page">
          <button
            type="button"
            className="wpn-pagination__arrow"
            aria-label="Previous page"
            disabled={safePage === 1 || totalItems === 0}
            onClick={() => onPageChange(safePage - 1)}
          >
            <Icon name="chevronLeft" className="wpn-pagination__arrow-icon" />
            Previous
          </button>
        </Tooltip>
        {getVisiblePages(safePage, totalPages).map((slot) =>
          typeof slot === "number" ? (
            <button
              key={slot}
              type="button"
              className={[
                "wpn-pagination__page",
                slot === safePage ? "wpn-pagination__page--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={`Page ${slot}`}
              aria-current={slot === safePage ? "page" : undefined}
              onClick={() => onPageChange(slot)}
            >
              {slot}
            </button>
          ) : (
            <span key={slot} className="wpn-pagination__ellipsis" aria-hidden="true">
              ...
            </span>
          ),
        )}
        <Tooltip label="Next page">
          <button
            type="button"
            className="wpn-pagination__arrow"
            aria-label="Next page"
            disabled={safePage >= totalPages || totalItems === 0}
            onClick={() => onPageChange(safePage + 1)}
          >
            <Icon name="chevronRight" className="wpn-pagination__arrow-icon" />
            Next
          </button>
        </Tooltip>
      </div>

      <div className="wpn-pagination__size">
        <span>Per page</span>
        <SearchableSelect
          options={PAGE_SIZE_OPTIONS}
          value={String(pageSize)}
          onChange={(next) => onPageSizeChange(Number(next))}
          ariaLabel="Rows per page"
          searchPlaceholder="Search"
          size="sm"
        />
      </div>
    </div>
  );
}

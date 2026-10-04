import { Fragment, type ReactNode } from "react";
import { TableSkeleton, type SkeletonCell } from "./TableSkeleton";

export type DataTableState = "loading" | "error" | "empty" | "ready";

export interface DataTableSkeletonConfig {
  rows: number;
  columns: SkeletonCell[];
  label: string;
}

export interface DataTableProps<T> {
  state: DataTableState;
  items: T[];
  getRowKey: (item: T) => string;
  renderRow: (item: T, index: number) => ReactNode;
  head: ReactNode;
  colgroup?: ReactNode;
  skeleton: DataTableSkeletonConfig;
  errorRow: ReactNode;
  emptyRow: ReactNode;
  tableClassName?: string;
  refetching?: boolean;
  pagination?: ReactNode;
  cardWrap?: boolean;
}

export interface ResolveDataTableStateArgs {
  loading: boolean;
  loaded: boolean;
  error: string | null;
  isEmpty: boolean;
}

export function resolveDataTableState({
  loading,
  loaded,
  error,
  isEmpty,
}: ResolveDataTableStateArgs): DataTableState {
  if (error) {
    return "error";
  }
  if (loading && !loaded) {
    return "loading";
  }
  return isEmpty ? "empty" : "ready";
}

export function DataTable<T>({
  state,
  items,
  getRowKey,
  renderRow,
  head,
  colgroup,
  skeleton,
  errorRow,
  emptyRow,
  tableClassName,
  refetching = false,
  pagination,
  cardWrap = true,
}: DataTableProps<T>) {
  const body =
    state === "loading" ? (
      <TableSkeleton {...skeleton} />
    ) : state === "error" ? (
      errorRow
    ) : state === "empty" ? (
      emptyRow
    ) : (
      items.map((item, index) => (
        <Fragment key={getRowKey(item)}>{renderRow(item, index)}</Fragment>
      ))
    );

  const table = (
    <div className="wpn-users-table-wrap">
      <table
        className={[
          "wpn-users-table",
          tableClassName,
          refetching ? "wpn-users-table--refetching" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {colgroup}
        <thead>
          <tr>{head}</tr>
        </thead>
        <tbody>{body}</tbody>
      </table>
    </div>
  );

  if (!cardWrap) {
    return (
      <>
        {table}
        {pagination}
      </>
    );
  }

  return (
    <div className="wpn-table-card">
      {table}
      {pagination}
    </div>
  );
}

"use client";

/*
 * Table — semantic table primitives styled with Chronicle tokens.
 *
 *   <Table aria-label="Runs" selectionMode="multiple" sortDescriptor={sort} onSortChange={setSort}>
 *     <TableHeader>
 *       <Column id="name" isRowHeader allowsSorting>Name</Column>
 *       <Column id="status">Status</Column>
 *     </TableHeader>
 *     <TableBody items={rows}>
 *       {(row) => (
 *         <Row>
 *           <Cell>{row.name}</Cell>
 *           <Cell>{row.status}</Cell>
 *         </Row>
 *       )}
 *     </TableBody>
 *   </Table>
 *
 * For a sticky header in a scroll container, wrap the table in your own
 * `<div className="overflow-auto max-h-[…]">`.
 */

import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "../utils/cn";

export const tableVariants = cva(
  "w-full border-separate border-spacing-0 border bg-surface-01 outline-none rounded-md border-hairline-strong"
);

export const tableHeaderVariants = cva("");
export const tableBodyVariants = cva("");

/*
 * Table primitives are plain semantic HTML (`<table>`/`<thead>`/`<tr>`/`<th>`).
 * Selection / focus styles use CSS pseudo classes; `data-selected` and
 * `data-allows-sorting` can be set on rows/columns by consumers.
 */
export const tableColumnVariants = cva(
  "sticky top-0 z-10 bg-surface-02 text-left align-middle outline-none data-[allows-sorting=true]:cursor-pointer focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember border-b border-hairline-strong px-[10px] py-[6px] font-sans text-[11px] font-medium tracking-normal text-l-ink-dim hover:text-l-ink"
);

export const tableRowVariants = cva(
  "group outline-none data-[selected=true]:bg-[rgba(216,67,10,0.06)] focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ember hover:bg-l-surface-hover"
);

export const tableCellVariants = cva(
  "align-middle outline-none border-b border-l-border-faint px-[10px] py-[6px] font-sans text-[13px] leading-snug text-l-ink"
);

export const tableSortIndicatorVariants = cva(
  "inline-block h-3 w-3 group-data-[sort-direction=descending]:rotate-180 ml-[4px] text-l-ink-dim"
);

export interface SortDescriptor {
  column: React.Key;
  direction: "ascending" | "descending";
}

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  className?: string;
  selectionMode?: "none" | "single" | "multiple" | string;
  sortDescriptor?: SortDescriptor;
  onSortChange?: (descriptor: SortDescriptor) => void;
}

export function Table({
  className,
  selectionMode: _selectionMode,
  sortDescriptor: _sortDescriptor,
  onSortChange: _onSortChange,
  ...rest
}: TableProps) {
  return <table {...rest} className={cn(tableVariants(), className)} />;
}

export interface TableHeaderProps
  extends React.HTMLAttributes<HTMLTableSectionElement> {
  className?: string;
}

export function TableHeader({ className, ...rest }: TableHeaderProps) {
  return <thead {...rest} className={cn(tableHeaderVariants(), className)} />;
}

export interface TableBodyProps<T extends object = object>
  extends Omit<React.HTMLAttributes<HTMLTableSectionElement>, "children"> {
  className?: string;
  items?: Iterable<T>;
  children?: React.ReactNode | ((item: T) => React.ReactNode);
}

export function TableBody<T extends object>({
  className,
  items,
  children,
  ...rest
}: TableBodyProps<T>) {
  const rows = items
    ? Array.from(items, (item, index) => (
        <React.Fragment key={index}>
          {(children as (item: T) => React.ReactNode)(item)}
        </React.Fragment>
      ))
    : children;

  return (
    <tbody {...rest} className={cn(tableBodyVariants(), className)}>
      {rows as React.ReactNode}
    </tbody>
  );
}

export interface ColumnProps
  extends Omit<
    React.ThHTMLAttributes<HTMLTableCellElement>,
    "className" | "children"
  > {
  className?: string;
  children?: React.ReactNode;
  allowsSorting?: boolean;
  sortDirection?: "ascending" | "descending";
  isRowHeader?: boolean;
}

export function Column({
  className,
  children,
  allowsSorting,
  sortDirection,
  isRowHeader,
  ...rest
}: ColumnProps) {
  return (
    <th
      {...rest}
      scope={isRowHeader ? "row" : "col"}
      className={cn(tableColumnVariants(), className)}
    >
      <span className="inline-flex items-center">
        {children as React.ReactNode}
        {allowsSorting ? (
          <span
            aria-hidden
            className={tableSortIndicatorVariants()}
            data-sort-direction={sortDirection}
          >
            <svg viewBox="0 0 12 12" fill="none" className="h-full w-full">
              <path
                d="M3 5l3 3 3-3"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        ) : null}
      </span>
    </th>
  );
}

export interface RowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  className?: string;
}

export function Row({ className, ...rest }: RowProps) {
  return <tr {...rest} className={cn(tableRowVariants(), className)} />;
}

export interface CellProps
  extends React.TdHTMLAttributes<HTMLTableCellElement> {
  className?: string;
}

export function Cell({ className, ...rest }: CellProps) {
  return <td {...rest} className={cn(tableCellVariants(), className)} />;
}

"use client";

/*
 * Table — row-selectable, sortable table backed by RAC's table collection.
 * Supports keyboard navigation (arrow/home/end/PgUp/PgDn), typeahead,
 * single/multiple row selection, column sort direction, and row actions.
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
 * `<div className="overflow-auto max-h-[…]">` — RAC's table renders
 * native `<table>` semantics so sticky positioning works as expected.
 */

import * as React from "react";
import {
  Table as RACTable,
  TableHeader as RACTableHeader,
  TableBody as RACTableBody,
  Column as RACColumn,
  Row as RACRow,
  Cell as RACCell,
  type TableProps as RACTableProps,
  type TableHeaderProps as RACTableHeaderProps,
  type TableBodyProps as RACTableBodyProps,
  type ColumnProps as RACColumnProps,
  type RowProps as RACRowProps,
  type CellProps as RACCellProps,
} from "react-aria-components";

import { tv } from "../utils/tv";
import { composeTwRenderProps } from "../utils/compose";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

const tableStyles = tv({
  slots: {
    table:
      "w-full border-separate border-spacing-0 border " +
      "bg-surface-01 outline-none",
    header: "",
    column:
      "sticky top-0 z-10 bg-surface-02 text-left align-middle " +
      "outline-none " +
      "data-[allows-sorting=true]:cursor-pointer " +
      "data-[focus-visible=true]:outline data-[focus-visible=true]:outline-1 " +
      "data-[focus-visible=true]:outline-ember",
    body: "",
    row:
      "group outline-none " +
      "data-[selected=true]:bg-[rgba(216,67,10,0.06)] " +
      "data-[focus-visible=true]:outline data-[focus-visible=true]:outline-1 " +
      "data-[focus-visible=true]:-outline-offset-1 data-[focus-visible=true]:outline-ember",
    cell: "align-middle outline-none",
    sortIndicator:
      "inline-block h-3 w-3 " +
      "group-data-[sort-direction=descending]:rotate-180",
  },
  variants: {
    density: {
      brand: {
        table: "rounded-md border-hairline",
        column:
          "border-b border-hairline-strong px-s-3 py-s-2 " +
          "font-mono text-mono-sm uppercase tracking-tactical text-ink-dim " +
          "data-[hovered=true]:text-ink-hi",
        row: "data-[hovered=true]:bg-surface-02",
        cell: "border-b border-hairline px-s-3 py-s-2 font-mono text-mono-lg text-ink",
        sortIndicator: "ml-s-1 text-ink-dim",
      },
      compact: {
        table: "rounded-l border-l-border",
        column:
          "border-b border-l-border px-[10px] py-[6px] " +
          "font-sans text-[11px] font-medium tracking-normal text-l-ink-dim " +
          "data-[hovered=true]:text-l-ink",
        row: "data-[hovered=true]:bg-l-surface-hover",
        cell: "border-b border-l-border-faint px-[10px] py-[6px] font-sans text-[13px] leading-snug text-l-ink",
        sortIndicator: "ml-[4px] text-l-ink-dim",
      },
    },
  },
  defaultVariants: { density: "brand" },
});

const TableDensityContext = React.createContext<"compact" | "brand" | undefined>(
  undefined,
);

export interface TableProps extends Omit<RACTableProps, "className"> {
  className?: string;
  density?: "compact" | "brand";
}

export function Table({ className, density: densityProp, ...rest }: TableProps) {
  const density = useResolvedChromeDensity(densityProp);
  const slots = tableStyles({ density });
  return (
    <TableDensityContext.Provider value={density}>
      <RACTable
        {...rest}
        data-density={density}
        className={composeTwRenderProps(className, slots.table())}
      />
    </TableDensityContext.Provider>
  );
}

export interface TableHeaderProps<T extends object = object> extends Omit<
  RACTableHeaderProps<T>,
  "className"
> {
  className?: string;
}

export function TableHeader<T extends object = object>({
  className,
  ...rest
}: TableHeaderProps<T>) {
  const ctxDensity = React.useContext(TableDensityContext);
  const density = useResolvedChromeDensity(ctxDensity);
  const slots = tableStyles({ density });
  return (
    <RACTableHeader
      {...(rest as RACTableHeaderProps<T>)}
      className={composeTwRenderProps(className, slots.header())}
    />
  );
}

export interface TableBodyProps<T extends object> extends Omit<
  RACTableBodyProps<T>,
  "className"
> {
  className?: string;
}

export function TableBody<T extends object>({
  className,
  ...rest
}: TableBodyProps<T>) {
  const ctxDensity = React.useContext(TableDensityContext);
  const density = useResolvedChromeDensity(ctxDensity);
  const slots = tableStyles({ density });
  return (
    <RACTableBody
      {...(rest as RACTableBodyProps<T>)}
      className={composeTwRenderProps(className, slots.body())}
    />
  );
}

export interface ColumnProps extends Omit<
  RACColumnProps,
  "className" | "children"
> {
  className?: string;
  children?: React.ReactNode;
}

export function Column({ className, children, ...rest }: ColumnProps) {
  const ctxDensity = React.useContext(TableDensityContext);
  const density = useResolvedChromeDensity(ctxDensity);
  const slots = tableStyles({ density });
  return (
    <RACColumn
      {...rest}
      className={composeTwRenderProps(className, slots.column())}
    >
      {({ allowsSorting, sortDirection }) => (
        <span className="inline-flex items-center">
          {children as React.ReactNode}
          {allowsSorting ? (
            <span
              aria-hidden
              className={slots.sortIndicator()}
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
      )}
    </RACColumn>
  );
}

export interface RowProps<T extends object = object> extends Omit<
  RACRowProps<T>,
  "className"
> {
  className?: string;
}

export function Row<T extends object = object>({
  className,
  ...rest
}: RowProps<T>) {
  const ctxDensity = React.useContext(TableDensityContext);
  const density = useResolvedChromeDensity(ctxDensity);
  const slots = tableStyles({ density });
  return (
    <RACRow
      {...(rest as RACRowProps<T>)}
      className={composeTwRenderProps(className, slots.row())}
    />
  );
}

export interface CellProps extends Omit<RACCellProps, "className"> {
  className?: string;
}

export function Cell({ className, ...rest }: CellProps) {
  const ctxDensity = React.useContext(TableDensityContext);
  const density = useResolvedChromeDensity(ctxDensity);
  const slots = tableStyles({ density });
  return (
    <RACCell
      {...rest}
      className={composeTwRenderProps(className, slots.cell())}
    />
  );
}

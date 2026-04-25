"use client";

import * as React from "react";
import { cx } from "../utils/cx";

/**
 * FilterBar — the 40 px Linear-density bar above lists and timelines.
 * Hosts a row of `<FilterPill>` (or `<Chip>`) entries on the left, an
 * "Add filter" + "Display" cluster after, and a small `Count` readout
 * on the right.
 *
 *   <FilterBar>
 *     <FilterPill … />
 *     <FilterPill … />
 *     <FilterBar.AddFilter onPress={…} />
 *     <FilterBar.Divider />
 *     <FilterBar.Display onPress={…} />
 *     <FilterBar.Spacer />
 *     <FilterBar.Count shown={8} total={42} unit="traces" />
 *   </FilterBar>
 *
 * Renders as a flush flex row; sits inside `AppShell`'s `filterBar`
 * slot.
 */

const FilterBarRoot = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function FilterBarRoot({ className, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      data-slot="filter-bar"
      className={cx("flex w-full items-center gap-[6px]", className)}
      {...props}
    >
      {children}
    </div>
  );
});

const Spacer = () => <div className="flex-1" data-slot="filter-bar-spacer" />;

const Divider = ({ className }: { className?: string }) => (
  <div
    aria-hidden
    className={cx("w-px h-[16px] bg-l-border mx-[4px]", className)}
  />
);

interface AddFilterProps extends React.HTMLAttributes<HTMLButtonElement> {
  label?: React.ReactNode;
}

const PlusIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M8 3v10M3 8h10" />
  </svg>
);

const AddFilter = React.forwardRef<HTMLButtonElement, AddFilterProps>(
  function AddFilter({ label = "Filter", className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        data-slot="filter-bar-add"
        className={cx(
          "inline-flex h-[22px] items-center gap-[4px] rounded-l border border-dashed border-l-border bg-transparent px-[8px]",
          "font-sans text-[11.5px] text-l-ink-lo",
          "hover:bg-l-wash-3 hover:border-l-border-strong hover:text-l-ink",
          "transition-colors duration-fast",
          className,
        )}
        {...props}
      >
        <PlusIcon />
        {label ? <span>{label}</span> : null}
      </button>
    );
  },
);

interface DisplayProps extends React.HTMLAttributes<HTMLButtonElement> {
  /** Show a small ember dot to signal a non-default display config. */
  changed?: boolean;
  label?: React.ReactNode;
}

const SlidersIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M2 4h4M10 4h4M2 8h8M12 8h2M2 12h3M9 12h5" />
    <circle cx="8" cy="4" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="11" cy="8" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="7" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

const Display = React.forwardRef<HTMLButtonElement, DisplayProps>(
  function Display({ changed, label = "Display", className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        data-slot="filter-bar-display"
        className={cx(
          "inline-flex h-[26px] items-center gap-[6px] rounded-l border border-l-border bg-transparent px-[10px]",
          "font-sans text-[12px] font-medium text-l-ink-lo",
          "hover:bg-l-wash-3 hover:text-l-ink hover:border-l-border-strong",
          "transition-colors duration-fast relative",
          className,
        )}
        {...props}
      >
        <SlidersIcon />
        <span>{label}</span>
        {changed ? (
          <span className="absolute right-[3px] top-[3px] h-[5px] w-[5px] rounded-pill bg-ember" />
        ) : null}
      </button>
    );
  },
);

interface ClearProps extends React.HTMLAttributes<HTMLButtonElement> {
  label?: React.ReactNode;
}

const Clear = React.forwardRef<HTMLButtonElement, ClearProps>(function Clear(
  { label = "Clear", className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      data-slot="filter-bar-clear"
      className={cx(
        "inline-flex h-[22px] items-center px-[8px] rounded-l text-[11.5px] text-l-ink-dim",
        "hover:bg-l-wash-3 hover:text-l-ink transition-colors duration-fast",
        className,
      )}
      {...props}
    >
      {label}
    </button>
  );
});

interface CountProps extends React.HTMLAttributes<HTMLSpanElement> {
  shown: number | string;
  total: number | string;
  unit?: React.ReactNode;
}

const Count = React.forwardRef<HTMLSpanElement, CountProps>(function Count(
  { shown, total, unit, className, ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      data-slot="filter-bar-count"
      className={cx(
        "font-mono text-[11.5px] text-l-ink-lo px-[4px]",
        className,
      )}
      {...props}
    >
      <b className="text-l-ink font-medium">{shown}</b>
      <span className="text-l-ink-dim mx-[6px]">/</span>
      {total}
      {unit ? <span className="ml-[6px]">{unit}</span> : null}
    </span>
  );
});

interface FilterBarNamespace
  extends React.ForwardRefExoticComponent<
    React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>
  > {
  Spacer: typeof Spacer;
  Divider: typeof Divider;
  AddFilter: typeof AddFilter;
  Display: typeof Display;
  Clear: typeof Clear;
  Count: typeof Count;
}

const FilterBar = FilterBarRoot as FilterBarNamespace;
FilterBar.Spacer = Spacer;
FilterBar.Divider = Divider;
FilterBar.AddFilter = AddFilter;
FilterBar.Display = Display;
FilterBar.Clear = Clear;
FilterBar.Count = Count;

export { FilterBar };

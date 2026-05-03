"use client";

/*
 * Autocomplete — wraps an always-visible collection (menu, listbox) with
 * a filter input. Unlike `Combobox`, it doesn't own the selection — the
 * wrapped collection does. Use this for command palettes, inline
 * typeahead filters, or embedded search-as-you-type surfaces.
 *
 *   <Autocomplete>
 *     <SearchField aria-label="Search">
 *       <Input placeholder="Filter…" />
 *     </SearchField>
 *     <Menu>
 *       <MenuItem>...</MenuItem>
 *     </Menu>
 *   </Autocomplete>
 */

import * as React from "react";
import { cva } from "class-variance-authority";

export const autocompleteVariants = cva(
  "flex flex-col gap-s-2 border shadow-panel rounded-md border-hairline-strong bg-l-surface-raised p-[6px] gap-[6px]"
);

export interface AutocompleteProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "className" | "children"> {
  className?: string;
  /** Children should include both an input (e.g. `<SearchField>` with
   * `<Input>`) and a collection (e.g. `<Menu>` or `<Listbox>`). */
  children: React.ReactNode;
}

export function Autocomplete({
  className,
  children,
  ...rest
}: AutocompleteProps) {
  return (
    <div {...rest} className={autocompleteVariants({ className })}>
      {children as React.ReactNode}
    </div>
  );
}

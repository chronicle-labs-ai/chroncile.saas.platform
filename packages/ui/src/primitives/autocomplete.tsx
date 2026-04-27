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
import {
  Autocomplete as RACAutocomplete,
  useFilter,
  type AutocompleteProps as RACAutocompleteProps,
} from "react-aria-components";

import { tv } from "../utils/tv";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

const autocompleteStyles = tv({
  base: "flex flex-col gap-s-2 border shadow-panel",
  variants: {
    density: {
      brand: "rounded-md border-hairline-strong bg-surface-02 p-s-2",
      compact: "rounded-l border-l-border bg-l-surface-raised p-[6px] gap-[6px]",
    },
  },
  defaultVariants: { density: "brand" },
});

export interface AutocompleteProps<
  T extends object = object,
> extends RACAutocompleteProps<T> {
  className?: string;
  density?: "compact" | "brand";
  /** Children should include both an input (e.g. `<SearchField>` with
   * `<Input>`) and a collection (e.g. `<Menu>` or `<Listbox>`). */
  children: React.ReactNode;
}

export function Autocomplete<T extends object = object>({
  className,
  children,
  filter,
  density: densityProp,
  ...rest
}: AutocompleteProps<T>) {
  const density = useResolvedChromeDensity(densityProp);
  const { contains } = useFilter({ sensitivity: "base" });
  return (
    <div className={autocompleteStyles({ density, className })} data-density={density}>
      <RACAutocomplete<T>
        {...rest}
        filter={
          filter ?? ((textValue, inputValue) => contains(textValue, inputValue))
        }
      >
        {children as React.ReactNode}
      </RACAutocomplete>
    </div>
  );
}

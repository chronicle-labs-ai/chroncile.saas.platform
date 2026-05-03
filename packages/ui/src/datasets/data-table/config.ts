/*
 * data-table/config — labels and constants used by the table chrome.
 *
 * Subset of tablecn's `dataTableConfig`; we only ship `sortOrders`
 * today since the dataset table doesn't yet expose the filter-list
 * / filter-menu flavors.
 */

export const dataTableConfig = {
  sortOrders: [
    { label: "Asc", value: "asc" as const },
    { label: "Desc", value: "desc" as const },
  ],
} as const;

export type DataTableConfig = typeof dataTableConfig;

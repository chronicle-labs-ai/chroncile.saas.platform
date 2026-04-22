# `@chronicle/ui` — Data filters

Linear-style data table filters for Chronicle surfaces. A Chronicle-native
port of [bazza/ui](https://ui.bazza.dev/docs/data-table-filter), rebuilt on
`react-aria-components`, `tailwind-variants`, and the `--c-*` / `--cg-*`
token layer. No Radix, no `cmdk`, no `tailwind-merge` — just the primitives
already in `packages/ui`.

## Quick start

```tsx
import {
  FilterBar,
  useDataTableFilters,
  type ColumnConfig,
} from "ui";

type Run = {
  id: string;
  status: "pass" | "fail" | "partial" | "pending";
  owners: string[];
  title: string;
  turns: number;
};

const columns: ColumnConfig<Run>[] = [
  {
    id: "status",
    label: "Status",
    type: "option",
    accessor: (r) => r.status,
    options: [
      { value: "pass", label: "Pass", tone: "green" },
      { value: "fail", label: "Fail", tone: "red" },
      { value: "partial", label: "Partial", tone: "amber" },
      { value: "pending", label: "Pending" },
    ],
  },
  {
    id: "owners",
    label: "Owner",
    type: "multiOption",
    accessor: (r) => r.owners,
    options: owners,
  },
  {
    id: "title",
    label: "Title",
    type: "text",
    accessor: (r) => r.title,
  },
  {
    id: "turns",
    label: "Turns",
    type: "number",
    accessor: (r) => r.turns,
  },
];

function RunsPage({ runs }: { runs: Run[] }) {
  const { filters, actions, predicate } = useDataTableFilters<Run>({ columns });
  const visible = React.useMemo(() => runs.filter(predicate), [runs, predicate]);

  return (
    <>
      <FilterBar columns={columns} filters={filters} actions={actions} />
      <RunsTable rows={visible} />
    </>
  );
}
```

## Column types

| Type          | Operators                               | Editor               |
| ------------- | --------------------------------------- | -------------------- |
| `option`      | `is`, `isNot`                           | Filterable list (single) |
| `multiOption` | `isAnyOf`, `isNoneOf`                   | Filterable list (multi)  |
| `text`        | `contains`, `doesNotContain`, `is`, `isNot` | Debounced input   |
| `number`      | `eq`, `neq`, `gt`, `lt`, `gte`, `lte`, `between` | Number field / range |

All operators are declared in [`operators.ts`](./operators.ts) and can be
extended by widening the `FilterOperator` union and adding a matching
`OperatorMeta` entry.

## Controlled vs. uncontrolled

```tsx
// Uncontrolled (default)
const { filters, actions, predicate } = useDataTableFilters({ columns });

// Controlled — sync to URL, Zustand, a server query, etc.
const [filters, setFilters] = useState<FilterState[]>([]);
const { predicate, actions } = useDataTableFilters({
  columns,
  filters,
  onFiltersChange: setFilters,
});
```

## Building your own UI on top

The hook is library-agnostic. If `FilterBar` doesn't match your layout, use
the lower-level pieces directly:

- `FilterPill` — one active filter chip.
- `FilterSelector` — the "+ Filter" column picker.
- `FilterOperatorMenu` — standalone operator dropdown.
- `OptionEditor` / `MultiOptionEditor` / `TextEditor` / `NumberEditor` — the
  four value popovers.

Everything reads from `ColumnConfig<TRow>` + `FilterState`, so you can
replace the pill with a Linear-style inline control or spread it across a
sidebar without forking.

## Theming

The components use Chronicle tokens directly — no Tailwind classes leak
through from `bg-neutral-*` or `text-gray-*`. Override by:

1. Wrapping `<FilterBar>` in a scoped class and shadowing tokens on that
   subtree, or
2. Replacing specific pieces (e.g. wrap `<FilterPill>` with your own `tv()`
   slots) and composing them into your own bar.

Surfaces used:

- Pill shell: `bg-surface-01 / border-hairline-strong`
- Popover: `bg-surface-02 / border-hairline-strong / shadow-panel`
- Focus ring: `outline-ember`
- Selected state: `bg-surface-03 / text-ink-hi`

## Scope (v1)

In:

- `option`, `multiOption`, `text`, `number` columns
- AND composition across filters
- Client-side `predicate(row)` evaluator
- Controlled and uncontrolled modes
- Full RAC keyboard accessibility

Out (tracked for a follow-up):

- `date` column type — blocked on a Chronicle `Calendar` primitive.
- AND/OR group nesting — bazza's base component is also AND-only.
- URL state sync — trivial follow-up when we wire `nuqs` into env-manager.
- Server-side strategy — the hook API is ready for a server adapter; we
  just haven't needed one yet.

## Running the tests

```sh
# from repo root
npx vitest run --root packages/ui \
  packages/ui/src/product/filters/use-data-table-filters.test.ts
```

Vitest resolves from the workspace root (hoisted via `apps/frontend`). When
`packages/ui` grows a proper test runner script the command will shorten.

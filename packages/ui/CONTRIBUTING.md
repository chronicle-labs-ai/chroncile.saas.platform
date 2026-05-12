# Contributing to `ui`

The Chronicle Labs design system. ~90 components across nine modules,
all built on React Aria Components + Tailwind + `tv()`.

This document is the source of truth for **how to add or change a
component without re-deriving the conventions every time**. Most lint
rules are advisory — these are the rules that actually keep the
package coherent.

If you find yourself fighting the rules, that's the signal to talk
about a new pattern, not to special-case the rule.

---

## 1. Module layout

Each top-level folder owns a slice of the system. A component lives in
the **lowest** module that all its consumers reach. If a second module
needs a helper, that's the signal to promote it — not to widen the
import.

| Folder           | Owns                                                                |
| ---------------- | ------------------------------------------------------------------- |
| `primitives/`    | App-agnostic UI atoms (Button, Input, Modal, Spinner, …)            |
| `typography/`    | `Display` / `Body` / `Mono` text primitives on the token scale      |
| `surfaces/`      | `GlassScene` / `LightSource` / `GlassPane` brand-surface system     |
| `layout/`        | Page-shell composites (AppShell, TopBar, Sidebar, PageHeader)       |
| `product/`       | Chronicle-specific composites (EventRow, RunsTable, TraceRow, …)    |
| `auth/`          | Auth-flow screens (`SignIn`, `SignUpEmail`, …) + `AuthShell`        |
| `onboarding/`    | Onboarding-flow screens + `OnboardingShell` + `data.ts` catalog     |
| `connectors/`    | Per-source connector modals + connector-shared primitives           |
| `icons/`         | Shared SVG glyphs (`SourceGlyph` for vendors, `glyphs.tsx` for UI)  |
| `theme/`         | `ThemeProvider`, theme toggle, theme bootstrap script               |
| `styles/`        | Global CSS — tokens, fonts, brand cascades that need theme awareness |
| `tokens/`        | TS mirrors of CSS tokens for `style={{ }}` props                    |
| `utils/`         | `cx`, `tv`, `composeTwRenderProps`, `dom`                           |

**Smell test:** if `onboarding/` reaches into `auth/_internal`, that
helper has outgrown its private home and should be promoted.

## 2. Public API discipline

- Every module has an `index.ts` barrel; only re-export what consumers
  should reach for.
- `_internal.tsx` files (leading underscore) are **private**. They
  must not be imported across module boundaries. If a second module
  needs them, promote them to `primitives/` (or to `icons/`, etc.).
- The root `src/index.ts` is the **single public surface**; everything
  re-exported there ships in the npm artifact.
- Path aliases inside the package go through relative imports
  (`../primitives/button`), never via the package name. This keeps
  bundlers happy and avoids ESM/CJS-resolution surprises.

## 3. Component conventions

- Filenames: kebab-case `.tsx` with a sibling `.stories.tsx`.
- **Named exports only** — no default exports.
- `"use client"` only when the component uses hooks, refs, browser
  APIs, or RAC interactivity. Pure presentational components stay
  server-renderable.
- Wrap RAC primitives, don't reinvent. Use `composeTwRenderProps` to
  merge variants with RAC's render-prop className API.
- Forward `className` through `tv()` so callers can override; never
  manually concatenate it onto a base string.
- Components that flip presentation when "active" / "selected" /
  "loading" use boolean props (`active`, `isLoading`, `invalid`)
  rather than enum strings. Match the RAC convention (`isLoading`,
  `isDisabled`, `isOpen`, `isPending`).

## 4. Variants — `tv()` vs `cx()`

Use `tv({ slots: ... })` whenever a component has **more than one
styled element** OR **more than one variant axis** (state, tone,
density, size). Use `cx()` for ad-hoc conditional class merges inside
a single render path.

Variant naming follows the existing language:

- `variant`    — visual (primary / secondary / ghost / ember)
- `size`       — sm / md / lg
- `density`    — `compact` / `brand`
- `tone`       — `default` / `auth` / `danger` / `warning` / `info`

Boolean variants (`active`, `disabled`, `invalid`) live as
`variants: { foo: { true: ..., false: ... } }`, not as ternary
`cx()` expressions sprinkled through JSX.

> `tv()` is wired with `twMerge: false` for performance — slot
> strings are layered in known order, so a stray `bg-*` override
> from a caller's `className` will not auto-deduplicate against the
> slot's own `bg-*`. If you need merge semantics, pass
> `{ twMerge: true }` to that single `tv()` call.

## 5. Controlled / uncontrolled props

Standard shape for any stateful primitive:

```tsx
interface FooProps {
  value?: T;
  defaultValue?: T;
  onChange?: (next: T) => void;
}

function Foo({ value, defaultValue, onChange }: FooProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState<T>(defaultValue ?? seed);
  const v = isControlled ? value! : internal;
  const set = (next: T) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };
}
```

Always call `onChange?.(next)` even in uncontrolled mode so parents
can listen without taking control.

## 6. Tokens, theming, and CSS

- **Always** prefer Tailwind tokens (`text-ink-hi`, `bg-surface-01`,
  `border-hairline-strong`, `text-event-green`) over raw color
  literals.
- Use `var(--c-*)` only inside `style={{ color: source.color }}` props
  where the value is data-driven.
- Components must work in both `data-theme="light"` and `"dark"` —
  never branch on theme in JS, let the cascade handle it.
- New CSS classes go in `src/styles/<module>.css` (or a sibling) ONLY
  when:
  - the cascade matters for theme overrides, OR
  - the rule needs `@keyframes`, `@media`, `::before`, or other
    things Tailwind can't express cleanly.
  Otherwise keep it in `tv()` / `cx()`.

## 7. Icons & SVG

- Shared glyphs live in `icons/`. Per-component inline `<svg>` is
  allowed only for one-off chrome (e.g. the `<Input search>` magnifier).
- Always use `fill="none" stroke="currentColor"` (or
  `fill="currentColor"`) so the parent `text-*` color paints the icon.
- Default `size` prop with a sensible default; the component returns a
  `<svg width={size} height={size}>` with `aria-hidden` for decorative
  use.
- Size convention:

  | Use case                       | Size |
  | ------------------------------ | ---- |
  | Inline label / chip            | 12   |
  | Form-field affordance          | 14   |
  | Button glyph                   | 16   |
  | `SourceGlyph` default          | 20   |
  | "Success seal" hero            | 28+  |

- Adding a new generic glyph: add it to `icons/glyphs.tsx`, re-export
  from `icons/index.ts`. Adding a new vendor mark: add to
  `icons/source-glyph.tsx` AND extend the `SourceGlyphId` union.

## 8. Accessibility

- Use the `<FormField>` primitive for any input — it handles
  label / description / error wiring, including the RAC `LabelContext`
  plumbing for compound fields.
- Live regions: `role="status" aria-live="polite"` for parse strips,
  spinners, "verifying…" indicators.
- Focus styling: every interactive element needs
  `focus-visible:outline` or `focus-visible:ring-1
  focus-visible:ring-ember`.
- Native `<button>` always gets `type="button"` unless it's actually
  a submit.
- Decorative SVGs get `aria-hidden`; meaningful ones get `aria-label`.

## 9. Animation

- Use the `cg-fade-up` / `cg-fade-up-1` / `cg-fade-up-2` / `cg-fade-up-3`
  cascade for staggered entrance.
- `cg-blink` for typewriter cursors; `cg-pulse-ember` for backfill /
  live-update indicators; `cg-slide-in` for ticker rows.
- Honor `prefers-reduced-motion` — already handled by `auth.css`, but
  any new keyframe must include the same media-query block.
- Avoid JS-driven animation loops for visual polish; reach for CSS
  first.

## 10. Domain catalog (`onboarding/data.ts`)

- This is the **single source of truth** for sources, templates, parse
  keywords, demo events, and domain hints.
- To add a source: extend `SourceId`, add a `Source` row, add a glyph
  in `icons/source-glyph.tsx` (and add the matching `SourceGlyphId`).
- The two unions (`SourceId`, `SourceGlyphId`) are intentionally
  decoupled via `Source.glyph: SourceGlyphId` so a source can switch
  glyphs without breaking type safety. Keep them in sync but don't
  merge them.
- `PARSE_KEYWORDS` order matters — earlier rules win. Add specific
  patterns before catch-all ones.

## 11. Storybook conventions

- Every component has a sibling `.stories.tsx`.
- Stories cover: default, every variant axis, error / loading states,
  dark and light theme (use the `themes` toolbar).
- Use `args` for interactive controls; reserve `parameters` for
  layout / backgrounds.
- Avoid runtime randomness in stories (or seed it) so Chromatic
  diffs stay stable.

## 12. Adding a new component — checklist

- [ ] Lives in the lowest-applicable module.
- [ ] Re-exported from the module's `index.ts` (or named with leading
      underscore if private).
- [ ] `tv()` for any styled state; tokens not raw colors;
      `currentColor` for icons.
- [ ] Sibling `.stories.tsx` with all variants + dark / light coverage.
- [ ] One-line JSDoc header explaining what + when to use (Storybook
      autodocs picks this up).
- [ ] `"use client"` only if needed.
- [ ] No reach across module boundaries except into `primitives/`,
      `icons/`, and `utils/`.
- [ ] Public API surface from `src/index.ts` updated if it's a new
      public component.

---

## Local development

```bash
yarn typecheck             # tsc --noEmit
yarn storybook             # storybook dev -p 6006
yarn build-storybook       # static build, deployable
```

Touched a primitive that lots of consumers use? Run `yarn typecheck`
from the repo root — apps in `apps/` re-export the same `ui` types.

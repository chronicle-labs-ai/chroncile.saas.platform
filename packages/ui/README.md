# `ui` — Chronicle Labs design system

The component library that ships every screen across the Chronicle
apps. Built on **React Aria Components** for behavior, **Tailwind CSS**
for styling, and **`tv()`** (tailwind-variants) for variant
composition. Theme-aware out of the box (light + dark via
`data-theme`). Zero runtime CSS-in-JS.

```tsx
import {
  AppShell,
  Button,
  EmptyState,
  ThemeProvider,
} from "ui";
import "ui/styles/globals.css";

export function App() {
  return (
    <ThemeProvider>
      <AppShell>
        <EmptyState
          title="Nothing here yet"
          action={<Button variant="ember">Connect a source</Button>}
        />
      </AppShell>
    </ThemeProvider>
  );
}
```

## Setup

`ui` is a workspace package (`packages/ui`) consumed via
`"ui": "*"` in app `package.json`s. From inside this package:

```bash
yarn typecheck             # tsc --noEmit (no build step — source ships as TS)
yarn storybook             # storybook dev -p 6006
yarn build-storybook       # static build → storybook-static/
```

The package is **source-only** — `main` and `types` both point at
`./src/index.ts`, so apps' bundlers compile it alongside their own
sources. There is no separate `dist/` step.

You **must** import the global stylesheet exactly once at the app
root:

```ts
import "ui/styles/globals.css";
```

This pulls in tokens, fonts, brand cascades, and the auth /
connectors keyframe sets. The Tailwind config is also exported for
apps that need to extend it:

```js
// tailwind.config.js
module.exports = require("ui/tailwind.config");
```

## Modules

The public API is sliced into the folders below. Reach for the
narrowest module that satisfies your need; deeper composites pull in
their dependencies for you.

| Module          | What's inside                                                       |
| --------------- | ------------------------------------------------------------------- |
| `primitives/`   | App-agnostic atoms — Button, Input, Modal, Tabs, Toast, Tooltip, …  |
| `typography/`   | `Display`, `Body`, `Mono` text primitives on the design-token scale |
| `surfaces/`     | `GlassScene`, `LightSource`, `GlassPane` brand-surface system       |
| `layout/`       | App composites — `AppShell`, `TopBar`, `Sidebar`, `PageHeader`      |
| `product/`      | Chronicle-specific composites — `EventRow`, `RunsTable`, `TraceRow` |
| `auth/`         | Auth-flow screens (`SignIn`, `SignUpEmail`, …) + `AuthShell`        |
| `onboarding/`   | Onboarding screens + `OnboardingShell` + the source / template catalog |
| `connectors/`   | Per-source connector modals (Stripe, Slack, HubSpot, …)             |
| `icons/`        | Shared SVG glyphs — `SourceGlyph` (vendors), `MailIcon`, `LockIcon` |
| `theme/`        | `ThemeProvider`, `ThemeToggle`, theme bootstrap script              |
| `tokens/`       | TS mirrors of the CSS color / spacing / radius tokens               |
| `styles/`       | Global CSS — `globals.css`, `tokens.css`, `auth.css`, `connectors.css` |

Every module has its own `index.ts` barrel; the root `src/index.ts`
re-exports everything that consumers should reach for.

## Storybook

Every component ships with a sibling `.stories.tsx`. Run
`yarn storybook` for the live workshop — it doubles as the visual-
spec doc and the regression baseline.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for module layout rules,
naming conventions, the `tv()` / `cx()` decision tree, controlled-prop
shape, theming rules, icon size convention, accessibility checklist,
animation primitives, and the new-component checklist.

The TL;DR: a component lives in the **lowest** module that all its
consumers reach. If a second module needs a private helper, that's the
signal to promote it.

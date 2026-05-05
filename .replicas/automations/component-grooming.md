# Component Grooming

Replicas automation that reviews every PR for UI bloat, raw-Tailwind visual styling in app code, and reinventions of `packages/ui` primitives. Posts a GitHub check run named **Component Grooming** with a pass/fail verdict and per-violation callouts.

## Trigger

| Field | Value |
| --- | --- |
| Type | GitHub |
| Events | `pull_request.opened`, `pull_request.synchronize` |
| Repository | `chronicle-labs-ai/chroncile.saas.platform` |
| Group PR events | on (follow-up commits reuse the same workspace) |
| Attach to user | on |
| Workspace lifecycle | `delete_when_done` |
| Environment | Default `chronicle-labs-ai/chroncile.saas.platform` |

## Prompt

```
Component Grooming check.

Whenever we add UI to the app, we want the surface to stay readable, the design system to stay canonical, and visual choices to live in one place. Engineers and coding agents often hand-roll markup with raw Tailwind because they don't realize the design system already covers the case, or because reaching for a typed primitive prop feels heavier than `className="text-orange-500"`. Same way they'll grow a client component to 600 LOC of mixed orchestration + presentation rather than carve it into a domain package. Your job is to check this PR and see if it introduces UI bloat, raw-Tailwind visual styling, or app-side reinventions of design-system primitives.

Steps:
1. Check out the PR branch locally. Before doing anything else, create an in-progress check run on the PR named "Component Grooming".
2. Review the diff and evaluate:
   a. Does this PR add or grow any client/UI file past ~300 LOC where the bulk is presentational markup that could decompose into smaller pieces or move into `packages/ui`?
   b. Does it use raw Tailwind utilities for VISUAL concerns (colors, surfaces, density, typography) in app code instead of the design system's typed props (`variant`, `tone`, `size`) on primitives like `<Alert>`, `<Button>`, `<Badge>`, `<EmptyState>`, `<PageHeader>`, `<Table>`, `<KvGrid>`?
   c. Does it hand-roll a markup pattern (table, banner, breadcrumb, viewport shell, modal-shaped form, empty state) that already exists as a primitive in `packages/ui/src/primitives/`, `layout/`, or one of the domain packages?
   d. Does it introduce a third occurrence of a copy-pasted layout, page wrapper, or header pattern that was previously duplicated once? Apply the rule of three — third occurrence is the cue to extract into `packages/ui`.
   e. Does it add a `className` escape hatch on a `packages/ui` primitive that lets the app override visual variants? Variants belong on the prop API, not on consumer overrides.
3. If the PR is well-written, mark the check as `success`. Otherwise mark it `failure` with a concise summary listing each violation with file:line references and the suggested fix (which primitive / typed prop / extraction to use). DO NOT make the edits yourself — this check is feedback for the PR author.

What to flag
- Client/UI files past ~300 LOC when the bulk is presentational markup. Suggest decomposing into typed primitives, a colocated `*-helpers.ts(x)` for pure helpers, or a new domain package under `packages/ui/src/<domain>/`.
- Raw Tailwind color, surface, density, or typography utilities used for visual styling in app code (`bg-orange-700/10`, `text-neutral-400`, `bg-yellow-700/10`, `border-event-amber/40`, `text-l-ink-dim` outside `packages/ui`). Visual look should be controlled by a primitive's typed props.
- App-side `<table>`, banner `<div role="alert">`, breadcrumb `<header>`, status pill `<span>`, "centered empty card" wrapper, or other markup that duplicates a primitive already exported from `packages/ui`.
- New `className` escape hatches added to `packages/ui` primitives that let the app override visual variants. Add a typed prop instead.
- The third occurrence of a copy-pasted page wrapper, header, breadcrumb, or empty-state block — first two are forgivable, third is the trigger to extract.
- New parallel domain components living in the app folder when an existing domain package (`agents/`, `datasets/`, `connections/`, `team/`, `environments/`) is the natural home.
- Inline server helpers (`getClientIp`, `lookupPrimaryOrgByEmail`, fetch-and-classify wrappers) duplicated across two or more route handlers when a `server/auth/` or `server/sandbox/` module is the natural home.
- Single-file dictionaries or registries (`humanize-backend-error.ts` style) growing past ~250 LOC of entries when a per-domain split is more navigable.

What NOT to flag — prefer false negatives over false positives. A missed nit is cheap; a noisy check trains engineers to ignore you.
- Layout glue in app code (`flex`, `gap-*`, `p-*`, `min-h-0`, `space-y-*`, `mx-auto`, `max-w-*`) — that's composition, not visual styling. Positioning ≠ visuals.
- Files >300 LOC that are pure orchestration: state machines, fetch wiring, redirect logic, multi-step page flows, route handlers with many branches. Length there is essential complexity.
- One-off internal admin / tooling routes that genuinely won't be reused.
- Tests, stories, fixtures, generated code (`packages/ui/src/bones/`), or files in `framer/`.
- Cases where the design system genuinely doesn't cover the visual concept yet — flag the missing primitive, not the workaround.
- 1–2 line Tailwind utility usage that's clearly composition (`mb-s-3`, `space-y-s-4`, `tabular-nums`) rather than visual variant selection.
- Two similar-looking blocks operating on different domains with diverging requirements. Forcing them together creates leaky abstractions.

You are providing this check for the PR creator to act on. Do not push edits to their branch.
```

## Registering this in Replicas

This file is the canonical spec — register it once via dashboard or API.

**Dashboard:** [chroncile.saas.platform workspace](https://www.replicas.dev/dashboard/workspaces/1025b3b4-8161-4484-a804-4f52694fd918) → Automations → New automation. Copy the trigger config and prompt above.

**REST:**

```bash
curl -X POST https://api.replicas.dev/v1/automations \
  -H "Authorization: Bearer $REPLICAS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --rawfile prompt <(sed -n '/^```$/,/^```$/p' .replicas/automations/component-grooming.md | sed '1d;$d') '
    {
      name: "Component Grooming",
      environment_id: env.REPLICAS_ENV_ID,
      prompt: $prompt,
      triggers: [
        { type: "github", config: { event: "pull_request.opened",     attach_to_user: true, group_pr_events: true } },
        { type: "github", config: { event: "pull_request.synchronize", attach_to_user: true, group_pr_events: true } }
      ],
      workspace_lifecycle_policy: "delete_when_done"
    }')"
```

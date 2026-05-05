# Framer code components

Source-of-truth files for the React code components we paste into
Framer's web editor. This folder is intentionally **outside** the
workspace TypeScript roots — none of these files import from
`@chronicle/ui`, design tokens, or any local package; they only depend
on what Framer's runtime ships:

- `framer` (property controls, layout decorators)
- `framer-motion`
- React

That keeps each file standalone, copy-pasteable into Framer, and free
of build configuration in this repo.

## Workflow

1. Edit the `.tsx` file here.
2. Copy the entire file contents.
3. In your Framer project: **Assets → Code → New File** (or open the
   matching existing code file) → paste over the contents.
4. Framer hot-reloads on save. Click **Preview** (Cmd-P) to see the
   `useEffect` animations run — the canvas shows a static snapshot.

## Components

The four components share a single theme palette, mono/sans typeface
stack, hairline-via-shadow border treatment, and entrance-animation
grammar (one-time ease-out stagger on mount, two looped CSS pulses
maximum, `useReducedMotion` respected). Dropped on the same marketing
page they read as a connected four-act story:

| Stage | Component | Beat |
|---|---|---|
| 1 | `mini-stream-timeline.tsx`     | **Capture** — production interactions land as event marks; one trace highlighted across rows. |
| 2 | `mini-scenario-discovery.tsx`  | **Discover** — streams collapse into a workflow DAG; the focal step expands into Captured / Adjacent / Emerging / Edge buckets. |
| 3 | `mini-backtest-arena.tsx`      | **Stress-test** — three agent candidates raced against Historical / Edge / Adjacent scenarios; outcomes render as a colour-coded matrix. |
| 4 | `mini-recovery-loop.tsx`       | **Monitor & recover** — live pass-rate sparkline, captured incident card, and a literal four-station ring (Detect → Reproduce → Patch → Verify) with an ember dot orbiting clockwise to signal continuous auto-healing. |

### `mini-recovery-loop.tsx`

1:1 aspect-ratio "monitor → capture → fix → verify" snapshot. Closes
the four-act story with a literal closed-loop ring. Three stacked
panels:

1. **Live monitor strip** — large mono pass-rate readout, colour-toned
   delta-vs-prior-hour chip, a 30-point pass-rate sparkline that draws
   in on mount with `pathLength` and carries a red dashed marker +
   dot at the moment the agent broke (`SPARK_DIP_INDEX = 27`), and
   a `1,842 calls / hr` mono counter on the right.
2. **Incident card** — red square `TriangleAlert` glyph that pulses
   via `mrl-pulse-incident` keyframe, mono trace id (`trace_b73x`)
   pinned next to the failing scenario name (`refund.race_condition`)
   in amber, and a `flagged` violet pill on the right (matching the
   trace-highlight ring in the stream timeline). Below is a 3-event
   mini timeline with marks colour-coded `ok` / `warn` / `fail` —
   the `fail` mark gets the same `0 0 0 1px page, 0 0 0 2px color`
   ring treatment used for trace highlights elsewhere. Footer
   confirms `✓ captured as test case · refund.race_condition_v3` next
   to an ember `open trace ↗` link.
3. **Recovery loop ring** — the hero. A literal SVG ring with four
   cardinal stations laid out by trig:
   - **Detect** (top, ✓ done, 12 incidents)
   - **Reproduce** (right, ✓ done, as test case)
   - **Patch** (bottom, ⟳ running, autonomous)
   - **Verify** (left, ○ queued, redeploy)

   Quarter-circle arcs connect them clockwise with arrowheads on each
   one. The arc leaving the active station is rendered ember (rest
   are `inkLo` at low opacity). A central 80px disc shows the agent
   id (`agent v4.2 · deployed`) with a softly-pulsing ember `Zap`
   glyph. An ember "discovery dot" orbits the ring continuously at
   `orbitSeconds` (default 9s) using a `useMotionValue` looped 0..2π
   in linear easing — Emil's blueprint says linear is correct for
   physical orbits, the only place I use it. Reduced motion parks
   the orbit dot exactly at the active station so the still image
   still tells the story.

   Geometry uses `ResizeObserver` to read the panel size, then
   computes `radius = min(w, h) / 2 − margin` so the ring scales
   gracefully if you resize the component beyond its 560 default.

#### Property controls

| Prop | Type | Notes |
|---|---|---|
| `agentLabel` | string | Centre disc + header subtitle (`agent v4.2`) |
| `passRateLabel`, `passDeltaLabel`, `callsLabel` | strings | Live monitor readouts; `passDeltaLabel` is colour-toned automatically (positive → green, negative → red) by parsing the leading sign |
| `alertsCount` | number | Header counter |
| `incidentTraceId`, `incidentScenario`, `incidentTimestamp` | strings | Editorial overrides for the incident card; the `_v3` test-case suffix is auto-derived |
| `orbitSeconds` | number 2–30 | Time for the ember dot to traverse the full ring |
| `page`, `surfaceBar*`, `ink*`, `ember`, `teal`, `violet`, `amber`, `eventGreen`, `eventRed` | colors | All Chronicle theme tokens individually exposed |

### `mini-backtest-arena.tsx`

1:1 aspect-ratio "stress-test" snapshot, mirroring the live
`BacktestRunning` and `BacktestResults` screens in the product. Tells
the value-prop in three stacked beats:

1. **Candidates strip** — three agent versions racing the same
   replicated production environment (`v4.0` baseline, `v4.1`
   challenger, `v4.2` latest). Each row pairs a hue dot with a
   partial-fill progress bar (the running tip pulses ember), a pass
   rate score in mono, and a `±N.Npp` delta-vs-baseline chip
   colour-coded by sign. The leading candidate gets an ember
   `chevron-up`.
2. **Scenario matrix** — the hero visualization. Three columns
   labelled **Historical** (`captured patterns`) / **Edge**
   (`stress cases`) / **Adjacent** (`variations`). Each column is a
   5-wide grid of small outcome tiles colour-coded by result:
   - **Pass** — solid green tile
   - **Regression** — solid red tile
   - **Review** — amber outline with centred dot
   - **Pending** — dim hairline-only outline
   - **Running** — ember tile with shimmer pulse
   A handful of tiles get a **violet ring** marking high-severity
   flagged divergences, matching the trace-highlight ring in the
   stream timeline.
3. **Verdict bar** — compact summary chips: pass rate · regression
   rate · flagged count · `promote ↗` ember CTA. The Verdict panel
   header reads "v4.2 leading" so the takeaway is unmistakable.

The header carries a 2px ember progress bar pinned to its bottom
edge, animated on mount with the same ease-out cubic as the rest of
the entrance stagger.

#### Property controls

| Prop | Type | Notes |
|---|---|---|
| `runId` | string | Mono ID printed next to the title (e.g. `run_a82c3`) |
| `progressPct` | number 0–100 | Drives both the header readout and the bottom-edge progress bar |
| `etaMinutes` | number | Header copy `ETA Nm` |
| `passRateLabel`, `regressionLabel` | string | Verdict chips — strings so you can show `89.4%`, `+5.2pp`, etc. |
| `flaggedCount` | number | Verdict chip count for high-severity divergences |
| `page`, `surfaceBar`, `surfaceBar2`, … | colors | All Chronicle theme tokens individually exposed |

### `mini-scenario-discovery.tsx`

1:1 aspect-ratio "discovery pipeline" snapshot. Tells the value-prop
story in three stacked beats:

1. **Capture** — three live source streams (Intercom, Stripe, Slack)
   render as colored mark bands.
2. **Reconstruct** — the underlying workflow shape is mined from those
   streams as a 5-node DAG (`auth.verify` → `fetch.profile` →
   `process.refund` → `notify.user` / `audit.log`). The focal node is
   ember-highlighted with a soft pulse and the edges leaving it are
   ember-toned to signal "this is where we're going next".
3. **Expand** — that focal step fans out into four scenario buckets:
   - **Captured** (ember, filled chips) — from real traces
   - **Adjacent** (violet, outline chips) — variations
   - **Emerging** (amber, outline chips) — new patterns
   - **Edge** (dim, dashed chips) — unusual

Animation grammar:

- One-time entrance stagger on mount (ease-out, 250–400ms) — streams
  fade in left-to-right, then workflow nodes pop in left-to-right, then
  scenario columns fade up one after another. After that, the
  composition is static so it doesn't keep flickering.
- Two looped pulses: the focal-node accent dot and the Captured-bucket
  header dot, both via off-main-thread CSS keyframes.
- Live indicator on the header (count + green pulsing ring).
- `useReducedMotion` parks the entrance animation and freezes both
  pulses.

#### Property controls

| Prop | Type | Notes |
|---|---|---|
| `focalLabel` | string | Workflow step the scenarios are expanded from |
| `capturedCount`, `adjacentCount`, `emergingCount`, `edgeCount` | number | Bucket counts shown in the columns and summed in the header total |
| `page`, `surfaceBar`, `surfaceBar2`, … | colors | All Chronicle theme tokens individually exposed |
| `intercomColor`, `stripeColor`, `slackColor` | colors | Per-source mark color |

### `mini-stream-timeline.tsx`

1:1 aspect-ratio port of `packages/ui/src/stream-timeline/StreamTimelineViewer`
in its **trace-highlighted** state.

Mirrors the real product surface:

- **Toolbar** — compact rail tuned for a 436px-wide square: icon-only
  Play/Pause and Fit buttons, labeled Live button (the pulsing red dot
  + "Live" word is iconic), and the violet active-trace chip pinned
  to the right edge with `· N` count and close X. The Topic·Trace
  segmented toggle and the playhead clock readout from the real
  product are intentionally dropped here — both are decorative in a
  static port and don't earn their pixel cost at this size.
- **Axis** — major + minor ticks, mono `MM:SS` labels, ember
  "now-ward" gradient on the right edge.
- **Rows** — seven event-source rows (Intercom, Stripe, Shopify,
  Slack, Zendesk, HubSpot, Salesforce) with `logo.dev` company marks
  and tinted-initial fallbacks.
- **Trace highlight** — five-event causal chain (`trace_9F3A` ·
  "Refund flow") overlaid with a violet ring on each trace mark and
  non-trace marks dimmed to 0.18 opacity.
- **Connector arcs** — SVG bezier overlay (causal = solid + arrowhead,
  sequential = dashed) using the same path math as
  `stream-timeline-connectors.tsx`.
- **Playhead** — teal when paused, ember when live; animated via a
  `framer-motion` `MotionValue` so the rows never re-render per frame.

Honors `prefers-reduced-motion`: parks the playhead at 70%, freezes
the live red dot.

#### Property controls

| Prop | Type | Notes |
|---|---|---|
| `playback` | enum | `live` / `playing` / `paused` |
| `loopSeconds` | number | Playhead loop duration when live/playing |
| `activeTraceHighlight` | bool | Toggle the violet ring + dimming |
| `showConnectors` | bool | Toggle the SVG arc overlay |
| `page`, `surfaceBar`, `surfaceBar2`, … | colors | All Chronicle theme tokens exposed individually so you can rebrand or flip to light from Framer's right panel |
| `intercomColor`, `stripeColor`, `shopifyColor`, `slackColor`, `zendeskColor`, `hubspotColor`, `salesforceColor` | colors | Per-source mark color |

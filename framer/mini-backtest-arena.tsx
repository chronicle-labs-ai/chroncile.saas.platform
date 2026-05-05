// @framerSupportedLayoutWidth: any
// @framerSupportedLayoutHeight: any
// @framerIntrinsicWidth: 560
// @framerIntrinsicHeight: 560

/**
 * Mini Backtest Arena — Chronicle "stress-test against your reality".
 *
 * A 1:1 marketing surface that mirrors the live `BacktestRunning` and
 * `BacktestResults` screens in the product. Tells the value-prop in
 * three stacked beats:
 *
 *   1. CANDIDATES — three agent versions racing against the same
 *      replicated production environment. Baseline is always at the
 *      top; challengers below show partial-fill progress bars.
 *   2. SCENARIO MATRIX — the hero visualization: three columns
 *      labelled Historical / Edge / Adjacent. Each column is a
 *      flex-wrap grid of outcome tiles colour-coded by result:
 *         • green  → pass
 *         • red    → regression vs baseline
 *         • amber  → needs review (within tolerance but flagged)
 *         • dim    → pending / queued
 *         • ember  → currently running (pulses)
 *      A handful of tiles get a violet ring marking high-severity
 *      flagged divergences.
 *   3. VERDICT — compact summary strip: pass rate / regression rate /
 *      flagged count / "promote to prod" ember CTA.
 *
 * Single file, only `framer` + `framer-motion`. Theme tokens mirror
 * Chronicle's `--c-*` palette, exposed individually as Framer property
 * controls so it flips cleanly to a light page or rebrand without
 * touching source.
 *
 * Design notes (Emil's principles applied):
 *   - Mono font + tabular-nums on every number.
 *   - Hairline dividers via `box-shadow: inset 0 ±1px 0`.
 *   - One-time entrance stagger (ease-out, 250–400ms): candidates
 *     left-to-right, then matrix tiles cascading column-by-column,
 *     then verdict chips. After that the composition is static.
 *   - The only looped motion is on running tiles (pulse) and the
 *     header's live ring. CSS keyframes off the main thread.
 *   - `useReducedMotion` parks the entrance animation and freezes
 *     both pulses.
 */

import { useMemo } from "react"
import type { CSSProperties, ReactNode } from "react"
import { addPropertyControls, ControlType } from "framer"
import { motion, useReducedMotion } from "framer-motion"

/* ─── Constants ─────────────────────────────────────────────── */

const HEADER_HEIGHT = 36
const SECTION_LABEL_HEIGHT = 18
const PANEL_GAP = 6

/* ─── Sample data ───────────────────────────────────────────── */

interface Candidate {
    id: string
    label: string
    sub: string
    hueKey: "teal" | "violet" | "ember"
    progress: number // 0..100
    passRatePct: number // 0..100
    deltaPp: number | null // delta vs baseline in percentage points; null = baseline
    running: boolean
    leader?: boolean
}

const CANDIDATES: Candidate[] = [
    {
        id: "v4.0",
        label: "v4.0",
        sub: "baseline",
        hueKey: "teal",
        progress: 100,
        passRatePct: 92.1,
        deltaPp: null,
        running: false,
    },
    {
        id: "v4.1",
        label: "v4.1",
        sub: "challenger",
        hueKey: "violet",
        progress: 64,
        passRatePct: 89.4,
        deltaPp: -2.7,
        running: true,
    },
    {
        id: "v4.2",
        label: "v4.2",
        sub: "latest",
        hueKey: "ember",
        progress: 47,
        passRatePct: 94.6,
        deltaPp: 2.5,
        running: true,
        leader: true,
    },
]

type CellState = "pass" | "regress" | "review" | "pending" | "running"

interface ScenarioBucket {
    id: "historical" | "edge" | "adjacent"
    label: string
    description: string
    states: CellState[]
    flaggedIndices: number[] // tiles to ring with violet
}

/** Build a fixed sample distribution for a bucket so the matrix
 *  reads as the right "shape" each refresh — no randomness. */
function buildStates(
    counts: Partial<Record<CellState, number>>,
    runningIndices: number[] = []
): CellState[] {
    const out: CellState[] = []
    const order: CellState[] = ["pass", "review", "regress", "pending"]
    for (const key of order) {
        const n = counts[key] ?? 0
        for (let i = 0; i < n; i++) out.push(key)
    }
    for (const i of runningIndices) {
        if (i >= 0 && i < out.length) out[i] = "running"
    }
    return out
}

const SCENARIO_BUCKETS: ScenarioBucket[] = [
    {
        id: "historical",
        label: "Historical",
        description: "captured patterns",
        states: buildStates(
            { pass: 26, review: 3, regress: 2, pending: 1 },
            [4, 17]
        ),
        flaggedIndices: [29],
    },
    {
        id: "edge",
        label: "Edge",
        description: "stress cases",
        states: buildStates(
            { pass: 12, review: 5, regress: 4, pending: 3 },
            [9, 20]
        ),
        flaggedIndices: [16, 19],
    },
    {
        id: "adjacent",
        label: "Adjacent",
        description: "variations",
        states: buildStates(
            { pass: 19, review: 4, regress: 2, pending: 3 },
            [11, 22]
        ),
        flaggedIndices: [21],
    },
]

/* ─── Inline lucide-style icons ─────────────────────────────── */

interface IconProps {
    size?: number
    strokeWidth?: number
    style?: CSSProperties
}

const Icon = ({
    size = 11,
    strokeWidth = 1.75,
    children,
    style,
}: IconProps & { children: ReactNode }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ display: "block", flexShrink: 0, ...style }}
        aria-hidden
    >
        {children}
    </svg>
)

const ActivityIcon = (p: IconProps) => (
    <Icon {...p}>
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </Icon>
)
const ChevronUpIcon = (p: IconProps) => (
    <Icon {...p}>
        <polyline points="18 15 12 9 6 15" />
    </Icon>
)
const CheckIcon = (p: IconProps) => (
    <Icon {...p} strokeWidth={p.strokeWidth ?? 2}>
        <polyline points="20 6 9 17 4 12" />
    </Icon>
)
const TriangleAlertIcon = (p: IconProps) => (
    <Icon {...p}>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </Icon>
)
const ArrowRightIcon = (p: IconProps) => (
    <Icon {...p}>
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
    </Icon>
)

/* ─── Theme tokens (exposed as Framer props) ─────────────────── */

interface Theme {
    page: string
    surfaceBar: string
    surfaceBar2: string
    surface: string
    hairline: string
    hairlineStrong: string
    inkHi: string
    ink: string
    inkLo: string
    inkDim: string
    inkFaint: string
    ember: string
    teal: string
    violet: string
    amber: string
    eventGreen: string
    eventRed: string
}

interface Props extends Theme {
    runId: string
    progressPct: number
    etaMinutes: number
    passRateLabel: string
    regressionLabel: string
    flaggedCount: number
}

/* ─── Top-level component ───────────────────────────────────── */

export default function MiniBacktestArena(props: Props) {
    const {
        page,
        surfaceBar,
        surfaceBar2,
        surface,
        hairline,
        hairlineStrong,
        inkHi,
        ink,
        inkLo,
        inkDim,
        inkFaint,
        ember,
        teal,
        violet,
        amber,
        eventGreen,
        eventRed,
        runId,
        progressPct,
        etaMinutes,
        passRateLabel,
        regressionLabel,
        flaggedCount,
    } = props

    const reducedMotion = useReducedMotion()

    const hueOf: Record<Candidate["hueKey"], string> = {
        teal,
        violet,
        ember,
    }

    const cellStateColor: Record<CellState, string> = useMemo(
        () => ({
            pass: eventGreen,
            regress: eventRed,
            review: amber,
            pending: inkDim,
            running: ember,
        }),
        [eventGreen, eventRed, amber, inkDim, ember]
    )

    return (
        <div
            role="img"
            aria-label="Chronicle backtest arena — three agent candidates stress-tested against historical, edge, and adjacent scenarios"
            style={{
                position: "relative",
                width: "100%",
                aspectRatio: "1 / 1",
                display: "flex",
                flexDirection: "column",
                background: page,
                color: ink,
                borderRadius: 6,
                overflow: "hidden",
                isolation: "isolate",
                fontFamily:
                    '"Inter", "Inter Variable", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
                fontVariantNumeric: "tabular-nums",
                WebkitFontSmoothing: "antialiased",
                boxShadow: `0 0 0 1px ${hairline}, 0 24px 60px rgba(0, 0, 0, 0.36)`,
                userSelect: "none",
            }}
        >
            <style>{`
                @keyframes mba-pulse-soft {
                    0%, 100% { opacity: 1; }
                    50%      { opacity: 0.40; }
                }
                @keyframes mba-pulse-ring {
                    0%   { transform: scale(1);   opacity: 0.55; }
                    100% { transform: scale(2.2); opacity: 0; }
                }
                @keyframes mba-running-shimmer {
                    0%, 100% { transform: scale(1); box-shadow: 0 0 0 1px rgba(216, 67, 10, 0.4); }
                    50%      { transform: scale(0.86); box-shadow: 0 0 8px rgba(216, 67, 10, 0.5); }
                }
                @media (prefers-reduced-motion: reduce) {
                    .mba-pulse-soft,
                    .mba-pulse-ring,
                    .mba-running {
                        animation: none !important;
                        opacity: 1 !important;
                        transform: none !important;
                    }
                }
            `}</style>

            <Header
                runId={runId}
                progressPct={progressPct}
                etaMinutes={etaMinutes}
                surfaceBar={surfaceBar}
                hairline={hairline}
                hairlineStrong={hairlineStrong}
                inkHi={inkHi}
                inkLo={inkLo}
                inkDim={inkDim}
                ember={ember}
                eventGreen={eventGreen}
                animate={!reducedMotion}
            />

            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    padding: "12px 14px 14px",
                    gap: PANEL_GAP,
                }}
            >
                <CandidatesPanel
                    candidates={CANDIDATES}
                    hueOf={hueOf}
                    surface={surface}
                    surfaceBar2={surfaceBar2}
                    hairline={hairline}
                    hairlineStrong={hairlineStrong}
                    inkHi={inkHi}
                    inkLo={inkLo}
                    inkDim={inkDim}
                    inkFaint={inkFaint}
                    ember={ember}
                    eventGreen={eventGreen}
                    eventRed={eventRed}
                    animate={!reducedMotion}
                />

                <ScenarioMatrix
                    buckets={SCENARIO_BUCKETS}
                    cellStateColor={cellStateColor}
                    surface={surface}
                    surfaceBar2={surfaceBar2}
                    hairline={hairline}
                    hairlineStrong={hairlineStrong}
                    inkHi={inkHi}
                    inkLo={inkLo}
                    inkDim={inkDim}
                    inkFaint={inkFaint}
                    ember={ember}
                    violet={violet}
                    page={page}
                    animate={!reducedMotion}
                />

                <Verdict
                    passRateLabel={passRateLabel}
                    regressionLabel={regressionLabel}
                    flaggedCount={flaggedCount}
                    surface={surface}
                    surfaceBar2={surfaceBar2}
                    hairline={hairline}
                    hairlineStrong={hairlineStrong}
                    inkHi={inkHi}
                    inkLo={inkLo}
                    inkDim={inkDim}
                    ember={ember}
                    violet={violet}
                    eventGreen={eventGreen}
                    eventRed={eventRed}
                    animate={!reducedMotion}
                />
            </div>
        </div>
    )
}

/* ─── Header ────────────────────────────────────────────────── */

function Header({
    runId,
    progressPct,
    etaMinutes,
    surfaceBar,
    hairline,
    hairlineStrong,
    inkHi,
    inkLo,
    inkDim,
    ember,
    eventGreen,
    animate,
}: {
    runId: string
    progressPct: number
    etaMinutes: number
    surfaceBar: string
    hairline: string
    hairlineStrong: string
    inkHi: string
    inkLo: string
    inkDim: string
    ember: string
    eventGreen: string
    animate: boolean
}) {
    const clamped = Math.max(0, Math.min(100, progressPct))

    return (
        <div
            style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 8,
                height: HEADER_HEIGHT,
                flexShrink: 0,
                padding: "0 12px",
                background: surfaceBar,
                boxShadow: `inset 0 -1px 0 ${hairline}`,
                color: inkHi,
                fontFamily:
                    '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 10,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                lineHeight: 1,
            }}
        >
            <span aria-hidden style={{ color: ember, display: "inline-flex" }}>
                <ActivityIcon size={12} strokeWidth={1.75} />
            </span>
            <span style={{ fontWeight: 620 }}>Backtest Arena</span>
            <span style={{ color: inkDim, marginLeft: 2 }}>· {runId}</span>

            <span
                style={{
                    marginLeft: "auto",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                }}
            >
                <span style={{ color: inkDim }}>
                    <span style={{ color: inkHi, fontWeight: 620 }}>
                        {clamped.toFixed(1)}%
                    </span>{" "}
                    · ETA {etaMinutes}m
                </span>
                <span style={{ position: "relative", width: 6, height: 6 }}>
                    <span
                        className="mba-pulse-ring"
                        aria-hidden
                        style={{
                            position: "absolute",
                            inset: 0,
                            borderRadius: 999,
                            background: eventGreen,
                            animation: animate
                                ? "mba-pulse-ring 1.8s ease-out infinite"
                                : undefined,
                        }}
                    />
                    <span
                        aria-hidden
                        style={{
                            position: "absolute",
                            inset: 0,
                            borderRadius: 999,
                            background: eventGreen,
                            boxShadow: `0 0 6px ${eventGreen}80`,
                        }}
                    />
                </span>
            </span>

            {/* Bottom-edge progress bar */}
            <span
                aria-hidden
                style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 2,
                    background: hairlineStrong,
                }}
            />
            <motion.span
                aria-hidden
                initial={animate ? { scaleX: 0 } : false}
                animate={{ scaleX: clamped / 100 }}
                transition={
                    animate
                        ? {
                              duration: 0.7,
                              delay: 0.15,
                              ease: [0.215, 0.61, 0.355, 1],
                          }
                        : { duration: 0 }
                }
                style={{
                    position: "absolute",
                    left: 0,
                    bottom: 0,
                    height: 2,
                    width: "100%",
                    transformOrigin: "left center",
                    background: ember,
                    boxShadow: `0 0 8px ${ember}66`,
                }}
            />
        </div>
    )
}

/* ─── Section panel shell ───────────────────────────────────── */

function PanelShell({
    label,
    meta,
    children,
    surface,
    hairline,
    hairlineStrong,
    inkDim,
    inkLo,
    grow = 1,
}: {
    label: string
    meta?: ReactNode
    children: ReactNode
    surface: string
    hairline: string
    hairlineStrong: string
    inkDim: string
    inkLo: string
    grow?: number
}) {
    return (
        <section
            style={{
                position: "relative",
                flex: grow,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                borderRadius: 6,
                background: `${surface}66`,
                boxShadow: `inset 0 0 0 1px ${hairline}`,
                overflow: "hidden",
            }}
        >
            <header
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexShrink: 0,
                    height: SECTION_LABEL_HEIGHT,
                    padding: "0 9px",
                    boxShadow: `inset 0 -1px 0 ${hairlineStrong}`,
                    fontFamily:
                        '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 9,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: inkDim,
                    lineHeight: 1,
                }}
            >
                <span style={{ color: inkLo, fontWeight: 620 }}>{label}</span>
                {meta ? (
                    <span style={{ marginLeft: "auto", color: inkDim }}>
                        {meta}
                    </span>
                ) : null}
            </header>
            <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
                {children}
            </div>
        </section>
    )
}

/* ─── Candidates panel ──────────────────────────────────────── */

function CandidatesPanel({
    candidates,
    hueOf,
    surface,
    surfaceBar2,
    hairline,
    hairlineStrong,
    inkHi,
    inkLo,
    inkDim,
    inkFaint,
    ember,
    eventGreen,
    eventRed,
    animate,
}: {
    candidates: Candidate[]
    hueOf: Record<Candidate["hueKey"], string>
    surface: string
    surfaceBar2: string
    hairline: string
    hairlineStrong: string
    inkHi: string
    inkLo: string
    inkDim: string
    inkFaint: string
    ember: string
    eventGreen: string
    eventRed: string
    animate: boolean
}) {
    const running = candidates.filter((c) => c.running).length

    return (
        <PanelShell
            label="Candidates"
            meta={`${candidates.length} agents · ${running} running`}
            surface={surface}
            hairline={hairline}
            hairlineStrong={hairlineStrong}
            inkDim={inkDim}
            inkLo={inkLo}
            grow={1.0}
        >
            <div
                style={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    padding: "8px 10px",
                    gap: 5,
                }}
            >
                {candidates.map((candidate, i) => (
                    <CandidateRow
                        key={candidate.id}
                        candidate={candidate}
                        hue={hueOf[candidate.hueKey]}
                        surfaceBar2={surfaceBar2}
                        hairline={hairline}
                        inkHi={inkHi}
                        inkLo={inkLo}
                        inkDim={inkDim}
                        inkFaint={inkFaint}
                        ember={ember}
                        eventGreen={eventGreen}
                        eventRed={eventRed}
                        animate={animate}
                        delay={i * 0.07}
                    />
                ))}
            </div>
        </PanelShell>
    )
}

function CandidateRow({
    candidate,
    hue,
    surfaceBar2,
    hairline,
    inkHi,
    inkLo,
    inkDim,
    inkFaint,
    ember,
    eventGreen,
    eventRed,
    animate,
    delay,
}: {
    candidate: Candidate
    hue: string
    surfaceBar2: string
    hairline: string
    inkHi: string
    inkLo: string
    inkDim: string
    inkFaint: string
    ember: string
    eventGreen: string
    eventRed: string
    animate: boolean
    delay: number
}) {
    const { progress, passRatePct, deltaPp, running, leader } = candidate
    const deltaTone =
        deltaPp == null ? inkDim : deltaPp >= 0 ? eventGreen : eventRed
    const passTone =
        passRatePct >= 92 ? eventGreen : passRatePct >= 88 ? hue : inkLo

    return (
        <motion.div
            initial={animate ? { opacity: 0, y: 4 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={
                animate
                    ? { duration: 0.32, delay, ease: [0.215, 0.61, 0.355, 1] }
                    : { duration: 0 }
            }
            style={{
                display: "grid",
                gridTemplateColumns: "auto 70px minmax(0, 1fr) 60px 56px",
                alignItems: "center",
                gap: 8,
                flex: 1,
                minHeight: 0,
            }}
        >
            <span
                aria-hidden
                style={{
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    background: hue,
                    boxShadow: `0 0 6px ${hue}66`,
                    flexShrink: 0,
                }}
            />

            <span
                style={{
                    display: "inline-flex",
                    alignItems: "baseline",
                    gap: 4,
                    fontFamily:
                        '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 11,
                    color: inkHi,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                }}
            >
                <span style={{ fontWeight: 620 }}>{candidate.label}</span>
                <span
                    style={{
                        fontSize: 9.5,
                        color: leader ? ember : inkFaint,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                    }}
                >
                    {candidate.sub}
                </span>
                {leader ? (
                    <span
                        aria-label="leading candidate"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            color: ember,
                            marginLeft: 1,
                        }}
                    >
                        <ChevronUpIcon size={10} strokeWidth={2} />
                    </span>
                ) : null}
            </span>

            <ProgressBar
                progress={progress}
                hue={hue}
                surfaceBar2={surfaceBar2}
                hairline={hairline}
                ember={ember}
                running={running}
                animate={animate}
                delay={delay + 0.1}
            />

            <span
                style={{
                    fontFamily:
                        '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 12,
                    color: passTone,
                    fontWeight: 620,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {passRatePct.toFixed(1)}%
            </span>

            <span
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 18,
                    padding: "0 6px",
                    borderRadius: 4,
                    background:
                        deltaPp == null ? "transparent" : `${deltaTone}1a`,
                    boxShadow:
                        deltaPp == null
                            ? undefined
                            : `inset 0 0 0 1px ${deltaTone}55`,
                    color: deltaTone,
                    fontFamily:
                        '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 9.5,
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                }}
            >
                {deltaPp == null
                    ? "—"
                    : `${deltaPp > 0 ? "+" : ""}${deltaPp.toFixed(1)}pp`}
            </span>
        </motion.div>
    )
}

function ProgressBar({
    progress,
    hue,
    surfaceBar2,
    hairline,
    ember,
    running,
    animate,
    delay,
}: {
    progress: number
    hue: string
    surfaceBar2: string
    hairline: string
    ember: string
    running: boolean
    animate: boolean
    delay: number
}) {
    const clamped = Math.max(0, Math.min(100, progress))
    return (
        <div
            style={{
                position: "relative",
                height: 8,
                borderRadius: 999,
                background: `${surfaceBar2}cc`,
                boxShadow: `inset 0 0 0 1px ${hairline}`,
                overflow: "hidden",
            }}
        >
            <motion.span
                aria-hidden
                initial={animate ? { scaleX: 0 } : false}
                animate={{ scaleX: clamped / 100 }}
                transition={
                    animate
                        ? {
                              duration: 0.55,
                              delay,
                              ease: [0.215, 0.61, 0.355, 1],
                          }
                        : { duration: 0 }
                }
                style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: "100%",
                    transformOrigin: "left center",
                    background: hue,
                    borderRadius: 999,
                    boxShadow: running ? `0 0 8px ${hue}55` : undefined,
                }}
            />
            {/* Tip indicator on running bars (ember pulse) */}
            {running && clamped < 100 ? (
                <motion.span
                    aria-hidden
                    className={animate ? "mba-pulse-soft" : undefined}
                    initial={animate ? { opacity: 0 } : false}
                    animate={{ opacity: 1 }}
                    transition={
                        animate
                            ? { duration: 0.4, delay: delay + 0.5 }
                            : { duration: 0 }
                    }
                    style={{
                        position: "absolute",
                        top: -1,
                        bottom: -1,
                        left: `${clamped}%`,
                        width: 2,
                        marginLeft: -1,
                        background: ember,
                        borderRadius: 1,
                        boxShadow: `0 0 6px ${ember}`,
                        animation: animate
                            ? "mba-pulse-soft 1.4s ease-in-out infinite"
                            : undefined,
                    }}
                />
            ) : null}
        </div>
    )
}

/* ─── Scenario matrix ───────────────────────────────────────── */

function ScenarioMatrix({
    buckets,
    cellStateColor,
    surface,
    surfaceBar2,
    hairline,
    hairlineStrong,
    inkHi,
    inkLo,
    inkDim,
    inkFaint,
    ember,
    violet,
    page,
    animate,
}: {
    buckets: ScenarioBucket[]
    cellStateColor: Record<CellState, string>
    surface: string
    surfaceBar2: string
    hairline: string
    hairlineStrong: string
    inkHi: string
    inkLo: string
    inkDim: string
    inkFaint: string
    ember: string
    violet: string
    page: string
    animate: boolean
}) {
    const total = buckets.reduce((sum, b) => sum + b.states.length, 0)
    const passing = buckets.reduce(
        (sum, b) =>
            sum +
            b.states.filter((s) => s === "pass" || s === "running").length,
        0
    )

    return (
        <PanelShell
            label="Scenarios"
            meta={`${passing}/${total} passing · 3 buckets`}
            surface={surface}
            hairline={hairline}
            hairlineStrong={hairlineStrong}
            inkDim={inkDim}
            inkLo={inkLo}
            grow={3.0}
        >
            <div
                style={{
                    height: "100%",
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 6,
                    padding: 8,
                }}
            >
                {buckets.map((bucket, i) => (
                    <BucketColumn
                        key={bucket.id}
                        bucket={bucket}
                        cellStateColor={cellStateColor}
                        surfaceBar2={surfaceBar2}
                        hairline={hairline}
                        inkHi={inkHi}
                        inkLo={inkLo}
                        inkDim={inkDim}
                        inkFaint={inkFaint}
                        ember={ember}
                        violet={violet}
                        page={page}
                        animate={animate}
                        columnDelay={0.25 + i * 0.08}
                    />
                ))}
            </div>
        </PanelShell>
    )
}

function BucketColumn({
    bucket,
    cellStateColor,
    surfaceBar2,
    hairline,
    inkHi,
    inkLo,
    inkDim,
    inkFaint,
    ember,
    violet,
    page,
    animate,
    columnDelay,
}: {
    bucket: ScenarioBucket
    cellStateColor: Record<CellState, string>
    surfaceBar2: string
    hairline: string
    inkHi: string
    inkLo: string
    inkDim: string
    inkFaint: string
    ember: string
    violet: string
    page: string
    animate: boolean
    columnDelay: number
}) {
    const total = bucket.states.length
    const passing = bucket.states.filter(
        (s) => s === "pass" || s === "running"
    ).length

    return (
        <motion.div
            initial={animate ? { opacity: 0, y: 4 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={
                animate
                    ? {
                          duration: 0.34,
                          delay: columnDelay,
                          ease: [0.215, 0.61, 0.355, 1],
                      }
                    : { duration: 0 }
            }
            style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                minHeight: 0,
                padding: "8px 8px 9px",
                borderRadius: 5,
                background: `${surfaceBar2}99`,
                boxShadow: `inset 0 0 0 1px ${hairline}`,
            }}
        >
            <header
                style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 6,
                    flexShrink: 0,
                }}
            >
                <span
                    style={{
                        fontFamily:
                            '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 9.5,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: inkHi,
                        fontWeight: 620,
                    }}
                >
                    {bucket.label}
                </span>
                <span
                    style={{
                        marginLeft: "auto",
                        fontFamily:
                            '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 9.5,
                        color: inkLo,
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    <span style={{ color: inkHi, fontWeight: 620 }}>
                        {passing}
                    </span>
                    <span style={{ color: inkFaint }}>/{total}</span>
                </span>
            </header>

            <span
                style={{
                    fontFamily:
                        '"Inter", "Inter Variable", ui-sans-serif, system-ui, sans-serif',
                    fontSize: 9.5,
                    color: inkDim,
                    flexShrink: 0,
                }}
            >
                {bucket.description}
            </span>

            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    display: "grid",
                    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                    gap: 3,
                    alignContent: "start",
                }}
            >
                {bucket.states.map((state, idx) => (
                    <Cell
                        key={idx}
                        state={state}
                        flagged={bucket.flaggedIndices.includes(idx)}
                        color={cellStateColor[state]}
                        ember={ember}
                        violet={violet}
                        hairline={hairline}
                        page={page}
                        animate={animate}
                        delay={columnDelay + 0.12 + idx * 0.012}
                    />
                ))}
            </div>
        </motion.div>
    )
}

function Cell({
    state,
    flagged,
    color,
    ember,
    violet,
    hairline,
    page,
    animate,
    delay,
}: {
    state: CellState
    flagged: boolean
    color: string
    ember: string
    violet: string
    hairline: string
    page: string
    animate: boolean
    delay: number
}) {
    const isPending = state === "pending"
    const isReview = state === "review"
    const isRunning = state === "running"

    /* Tile fill: solid for pass/regress/running; outline for review;
       dim hairline-only for pending. */
    const background = isPending
        ? "transparent"
        : isReview
          ? `${color}29`
          : `${color}cc`
    const ringColor = isReview ? `${color}aa` : `${color}33`
    const tileShadow = isPending
        ? `inset 0 0 0 1px ${hairline}`
        : isRunning
          ? `inset 0 0 0 1px ${ember}cc, 0 0 8px ${ember}66`
          : isReview
            ? `inset 0 0 0 1px ${ringColor}`
            : `inset 0 0 0 1px ${ringColor}`

    return (
        <motion.span
            aria-hidden
            initial={animate ? { opacity: 0, scale: 0.5 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={
                animate
                    ? {
                          duration: 0.24,
                          delay,
                          ease: [0.215, 0.61, 0.355, 1],
                      }
                    : { duration: 0 }
            }
            className={isRunning && animate ? "mba-running" : undefined}
            style={{
                position: "relative",
                aspectRatio: "1 / 1",
                borderRadius: 2,
                background,
                boxShadow: tileShadow,
                animation:
                    isRunning && animate
                        ? "mba-running-shimmer 1.4s ease-in-out infinite"
                        : undefined,
            }}
        >
            {/* Center dot for review tiles (signals "needs attention") */}
            {isReview ? (
                <span
                    aria-hidden
                    style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        width: "30%",
                        height: "30%",
                        transform: "translate(-50%, -50%)",
                        borderRadius: 999,
                        background: color,
                    }}
                />
            ) : null}

            {/* Violet ring for flagged divergences */}
            {flagged ? (
                <span
                    aria-hidden
                    style={{
                        position: "absolute",
                        inset: -2,
                        borderRadius: 4,
                        boxShadow: `0 0 0 1px ${page}, 0 0 0 2px ${violet}cc`,
                        pointerEvents: "none",
                    }}
                />
            ) : null}
        </motion.span>
    )
}

/* ─── Verdict bar ───────────────────────────────────────────── */

function Verdict({
    passRateLabel,
    regressionLabel,
    flaggedCount,
    surface,
    surfaceBar2,
    hairline,
    hairlineStrong,
    inkHi,
    inkLo,
    inkDim,
    ember,
    violet,
    eventGreen,
    eventRed,
    animate,
}: {
    passRateLabel: string
    regressionLabel: string
    flaggedCount: number
    surface: string
    surfaceBar2: string
    hairline: string
    hairlineStrong: string
    inkHi: string
    inkLo: string
    inkDim: string
    ember: string
    violet: string
    eventGreen: string
    eventRed: string
    animate: boolean
}) {
    return (
        <PanelShell
            label="Verdict"
            meta="v4.2 leading"
            surface={surface}
            hairline={hairline}
            hairlineStrong={hairlineStrong}
            inkDim={inkDim}
            inkLo={inkLo}
            grow={0.8}
        >
            <div
                style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "0 9px",
                }}
            >
                <VerdictChip
                    icon={<CheckIcon size={10} strokeWidth={2.2} />}
                    label="pass"
                    value={passRateLabel}
                    tone={eventGreen}
                    variant="filled"
                    surfaceBar2={surfaceBar2}
                    delay={0.55}
                    animate={animate}
                />
                <VerdictChip
                    icon={<TriangleAlertIcon size={10} strokeWidth={1.75} />}
                    label="regress"
                    value={regressionLabel}
                    tone={eventRed}
                    variant="outline"
                    surfaceBar2={surfaceBar2}
                    delay={0.62}
                    animate={animate}
                />
                <VerdictChip
                    label="flagged"
                    value={String(flaggedCount)}
                    tone={violet}
                    variant="filled"
                    surfaceBar2={surfaceBar2}
                    delay={0.69}
                    animate={animate}
                />
                <motion.button
                    type="button"
                    aria-label="Promote to production"
                    initial={animate ? { opacity: 0, x: -3 } : false}
                    animate={{ opacity: 1, x: 0 }}
                    transition={
                        animate
                            ? {
                                  duration: 0.3,
                                  delay: 0.78,
                                  ease: [0.215, 0.61, 0.355, 1],
                              }
                            : { duration: 0 }
                    }
                    style={{
                        marginLeft: "auto",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        height: 22,
                        padding: "0 9px",
                        borderRadius: 4,
                        background: `${ember}1a`,
                        boxShadow: `inset 0 0 0 1px ${ember}66, 0 0 12px ${ember}33`,
                        color: ember,
                        fontFamily:
                            '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 10,
                        fontWeight: 620,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        border: "none",
                        cursor: "default",
                        whiteSpace: "nowrap",
                    }}
                >
                    promote
                    <ArrowRightIcon size={10} strokeWidth={1.75} />
                </motion.button>
            </div>
        </PanelShell>
    )
}

function VerdictChip({
    icon,
    label,
    value,
    tone,
    variant,
    surfaceBar2,
    animate,
    delay,
}: {
    icon?: ReactNode
    label: string
    value: string
    tone: string
    variant: "filled" | "outline"
    surfaceBar2: string
    animate: boolean
    delay: number
}) {
    const isFilled = variant === "filled"
    return (
        <motion.span
            initial={animate ? { opacity: 0, y: 3 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={
                animate
                    ? { duration: 0.3, delay, ease: [0.215, 0.61, 0.355, 1] }
                    : { duration: 0 }
            }
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                height: 22,
                padding: "0 8px",
                borderRadius: 4,
                background: isFilled ? `${tone}1a` : "transparent",
                boxShadow: `inset 0 0 0 1px ${tone}55`,
                color: tone,
                fontFamily:
                    '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 10,
                lineHeight: 1,
                whiteSpace: "nowrap",
            }}
        >
            {icon ? (
                <span style={{ display: "inline-flex" }}>{icon}</span>
            ) : null}
            <span
                style={{
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    fontWeight: 620,
                }}
            >
                {label}
            </span>
            <span
                style={{ fontVariantNumeric: "tabular-nums", fontWeight: 620 }}
            >
                {value}
            </span>
        </motion.span>
    )
}

/* ─── Defaults + Framer property controls ───────────────────── */

MiniBacktestArena.defaultProps = {
    page: "#0c0d10",
    surfaceBar: "#131418",
    surfaceBar2: "#191a1f",
    surface: "#13151a",
    hairline: "rgba(255, 255, 255, 0.10)",
    hairlineStrong: "rgba(255, 255, 255, 0.16)",
    inkHi: "#f7f8f8",
    ink: "#d0d6e0",
    inkLo: "#8a8f98",
    inkDim: "#62666d",
    inkFaint: "rgba(247, 248, 248, 0.45)",
    ember: "#d8430a",
    teal: "#2dd4bf",
    violet: "#8b5cf6",
    amber: "#fbbf24",
    eventGreen: "#4ade80",
    eventRed: "#ef4444",
    runId: "run_a82c3",
    progressPct: 47,
    etaMinutes: 4,
    passRateLabel: "89.4%",
    regressionLabel: "11.2%",
    flaggedCount: 23,
}

addPropertyControls(MiniBacktestArena, {
    runId: {
        type: ControlType.String,
        title: "Run ID",
        defaultValue: "run_a82c3",
    },
    progressPct: {
        type: ControlType.Number,
        title: "Progress",
        defaultValue: 47,
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
    },
    etaMinutes: {
        type: ControlType.Number,
        title: "ETA",
        defaultValue: 4,
        min: 0,
        max: 999,
        step: 1,
        unit: "m",
    },
    passRateLabel: {
        type: ControlType.String,
        title: "Pass Rate",
        defaultValue: "89.4%",
    },
    regressionLabel: {
        type: ControlType.String,
        title: "Regression",
        defaultValue: "11.2%",
    },
    flaggedCount: {
        type: ControlType.Number,
        title: "Flagged",
        defaultValue: 23,
        min: 0,
        max: 9999,
        step: 1,
    },
    page: { type: ControlType.Color, title: "Page", defaultValue: "#0c0d10" },
    surfaceBar: {
        type: ControlType.Color,
        title: "Surface Bar",
        defaultValue: "#131418",
    },
    surfaceBar2: {
        type: ControlType.Color,
        title: "Surface Bar 2",
        defaultValue: "#191a1f",
    },
    surface: {
        type: ControlType.Color,
        title: "Surface",
        defaultValue: "#13151a",
    },
    hairline: {
        type: ControlType.Color,
        title: "Hairline",
        defaultValue: "rgba(255, 255, 255, 0.10)",
    },
    hairlineStrong: {
        type: ControlType.Color,
        title: "Hairline Strong",
        defaultValue: "rgba(255, 255, 255, 0.16)",
    },
    inkHi: {
        type: ControlType.Color,
        title: "Ink Hi",
        defaultValue: "#f7f8f8",
    },
    ink: { type: ControlType.Color, title: "Ink", defaultValue: "#d0d6e0" },
    inkLo: {
        type: ControlType.Color,
        title: "Ink Lo",
        defaultValue: "#8a8f98",
    },
    inkDim: {
        type: ControlType.Color,
        title: "Ink Dim",
        defaultValue: "#62666d",
    },
    inkFaint: {
        type: ControlType.Color,
        title: "Ink Faint",
        defaultValue: "rgba(247, 248, 248, 0.45)",
    },
    ember: {
        type: ControlType.Color,
        title: "Ember (Running)",
        defaultValue: "#d8430a",
    },
    teal: {
        type: ControlType.Color,
        title: "Teal (Baseline)",
        defaultValue: "#2dd4bf",
    },
    violet: {
        type: ControlType.Color,
        title: "Violet (Flag)",
        defaultValue: "#8b5cf6",
    },
    amber: {
        type: ControlType.Color,
        title: "Amber (Review)",
        defaultValue: "#fbbf24",
    },
    eventGreen: {
        type: ControlType.Color,
        title: "Pass",
        defaultValue: "#4ade80",
    },
    eventRed: {
        type: ControlType.Color,
        title: "Regression",
        defaultValue: "#ef4444",
    },
})

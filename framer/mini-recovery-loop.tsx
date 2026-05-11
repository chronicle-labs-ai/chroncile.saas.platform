// @framerSupportedLayoutWidth: any
// @framerSupportedLayoutHeight: any
// @framerIntrinsicWidth: 560
// @framerIntrinsicHeight: 560

/**
 * Mini Recovery Loop — Chronicle continuous-monitoring dashboard.
 *
 * Three stacked sections inside a 1:1 frame, each with a distinct
 * visual treatment so the surface reads as a monitoring dashboard,
 * not just another list:
 *
 *   1. LIVE MONITOR — hero pass-rate number, delta-vs-prior-hour
 *      chip, full-width sparkline with a red dip marker, and a
 *      single inline stat strip beneath (calls/hr · error % · alerts).
 *      The "vital sign" of the deployed agent.
 *   2. INCIDENT CARD — single captured failure: severity-coded
 *      status icon, trace id, scenario name, severity badge, mini
 *      event timeline with the failing event ringed, and a footer
 *      confirming the failure was captured as a reproducible test
 *      case.
 *   3. RECOVERY PIPELINE — the closed loop, drawn flat. Four
 *      horizontal stage segments (Detect / Reproduce / Patch /
 *      Verify) with status circles + name + sub label, connected
 *      by chevron arrows. A curved SVG arrow loops back below from
 *      Verify to Detect, terminating in an arrowhead — the literal
 *      "↻ continuous" path. The active stage glows ember and
 *      pulses softly.
 *
 * Single file, only `framer` + `framer-motion`. No `lucide-react`.
 *
 * Design notes (Emil + Chronicle):
 *   - Mono font + tabular-nums on every number.
 *   - Section dividers via `box-shadow: inset 0 ±1px 0 hairline`,
 *     no rounded panel chrome.
 *   - Mount cascade (ease-out cubic, 280–340ms): header, live
 *     monitor, incident, pipeline. Sparkline + pipeline arrows
 *     draw in via `pathLength`. After mount, two CSS-keyframe
 *     pulses run — header live ring + active pipeline stage —
 *     plus a subtle traveling dot on the loop-back arrow.
 *   - `useReducedMotion` parks the entrance, freezes both pulses,
 *     and stops the traveling dot at the active station.
 */

import { useEffect, useRef, useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import { addPropertyControls, ControlType } from "framer"
import {
    animate,
    motion,
    useMotionValue,
    useReducedMotion,
    useTransform,
} from "framer-motion"

/* ─── Constants ─────────────────────────────────────────────── */

const HEADER_HEIGHT = 32

/* ─── Sample data ───────────────────────────────────────────── */

/* Pass-rate sparkline: 30 points carrying a deliberate red-dip near
   the end (index 26..28) where the agent broke. */
const SPARK_VALUES: number[] = [
    98.6, 98.8, 98.9, 99.1, 98.7, 99.0, 99.2, 99.3, 98.8, 99.1,
    99.2, 99.4, 99.0, 99.1, 99.3, 99.2, 99.4, 99.5, 99.3, 99.4,
    99.2, 99.1, 99.0, 98.9, 98.7, 98.5,  92.4, 91.8, 96.1, 98.2,
]
const SPARK_DIP_INDEX = 27

interface IncidentEvent {
    id: string
    label: string
    pos: number    // percent across the timeline 0..100
    state: "ok" | "warn" | "fail"
}

const INCIDENT_EVENTS: IncidentEvent[] = [
    { id: "ev_1", label: "stripe.charge.refund.start",   pos: 12, state: "ok"   },
    { id: "ev_2", label: "db.transaction.lock.timeout",  pos: 48, state: "warn" },
    { id: "ev_3", label: "stripe.refund.failed",         pos: 86, state: "fail" },
]

type StageStatus = "done" | "running" | "queued"

interface PipelineStage {
    id: "detect" | "reproduce" | "patch" | "verify"
    label: string
    sub: string
    status: StageStatus
}

const PIPELINE_STAGES: PipelineStage[] = [
    { id: "detect",    label: "Detect",    sub: "12 incidents",    status: "done"    },
    { id: "reproduce", label: "Reproduce", sub: "3 test cases",    status: "done"    },
    { id: "patch",     label: "Patch",     sub: "v4.2-fix1",       status: "running" },
    { id: "verify",    label: "Verify",    sub: "awaiting deploy", status: "queued"  },
]

/* ─── Inline lucide-style icons ─────────────────────────────── */

interface IconProps { size?: number; strokeWidth?: number; style?: CSSProperties }

const Icon = ({
    size = 11, strokeWidth = 1.75, children, style,
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
const ChevronRightIcon = (p: IconProps) => (
    <Icon {...p}>
        <polyline points="9 18 15 12 9 6" />
    </Icon>
)
const TriangleAlertIcon = (p: IconProps) => (
    <Icon {...p}>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </Icon>
)
const CheckIcon = (p: IconProps) => (
    <Icon {...p} strokeWidth={p.strokeWidth ?? 2}>
        <polyline points="20 6 9 17 4 12" />
    </Icon>
)
const ArrowUpRightIcon = (p: IconProps) => (
    <Icon {...p}>
        <line x1="7" y1="17" x2="17" y2="7" />
        <polyline points="7 7 17 7 17 17" />
    </Icon>
)
const RotateIcon = (p: IconProps) => (
    <Icon {...p}>
        <path d="M21 12a9 9 0 1 1-3-6.71" />
        <polyline points="21 4 21 12 13 12" />
    </Icon>
)

/* ─── Status circle (Linear-style progress glyph) ───────────── */

type StatusGlyph = "filled" | "three-quarter" | "half" | "dotted"

function StatusCircle({
    glyph, color, size = 12,
}: {
    glyph: StatusGlyph
    color: string
    size?: number
}) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 12 12"
            aria-hidden
            style={{ display: "block", flexShrink: 0 }}
        >
            {glyph === "filled" ? (
                <circle cx={6} cy={6} r={4.5} fill={color} />
            ) : null}
            {glyph === "three-quarter" ? (
                <>
                    <circle
                        cx={6} cy={6} r={4}
                        fill="none"
                        stroke={color}
                        strokeWidth={1.2}
                    />
                    <path d="M 6 2 A 4 4 0 1 1 2 6 L 6 6 Z" fill={color} />
                </>
            ) : null}
            {glyph === "half" ? (
                <>
                    <circle
                        cx={6} cy={6} r={4}
                        fill="none"
                        stroke={color}
                        strokeWidth={1.2}
                    />
                    <path d="M 6 2 A 4 4 0 0 1 6 10 L 6 6 Z" fill={color} />
                </>
            ) : null}
            {glyph === "dotted" ? (
                <circle
                    cx={6} cy={6} r={4}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.2}
                    strokeDasharray="1.4 1.4"
                />
            ) : null}
        </svg>
    )
}

/* ─── Theme tokens (exposed as Framer props) ─────────────────── */

interface Theme {
    page: string
    surfaceBar: string
    surface: string
    wash: string
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
    agentLabel: string
    alertsCount: number
    passRateLabel: string
    passDeltaLabel: string
    callsLabel: string
    errorRateLabel: string
    errorDeltaLabel: string
    incidentTraceId: string
    incidentScenario: string
    incidentTimestamp: string
    loopSeconds: number
}

/* ─── Top-level component ───────────────────────────────────── */

export default function MiniRecoveryLoop(props: Props) {
    const {
        page, surfaceBar, surface, wash,
        hairline, hairlineStrong,
        inkHi, ink, inkLo, inkDim, inkFaint,
        ember, teal, violet, amber, eventGreen, eventRed,
        agentLabel, alertsCount,
        passRateLabel, passDeltaLabel, callsLabel,
        errorRateLabel, errorDeltaLabel,
        incidentTraceId, incidentScenario, incidentTimestamp,
        loopSeconds,
    } = props

    const reducedMotion = useReducedMotion()

    return (
        <div
            role="img"
            aria-label="Chronicle continuous monitoring dashboard — live agent metrics, captured incident, and the autonomous recovery pipeline"
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
                @keyframes mrl-pulse-soft {
                    0%, 100% { opacity: 1; }
                    50%      { opacity: 0.42; }
                }
                @keyframes mrl-pulse-ring {
                    0%   { transform: scale(1);   opacity: 0.55; }
                    100% { transform: scale(2.0); opacity: 0; }
                }
                @keyframes mrl-pulse-incident {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.55); }
                    50%      { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
                }
                @media (prefers-reduced-motion: reduce) {
                    .mrl-pulse-soft,
                    .mrl-pulse-ring,
                    .mrl-pulse-incident {
                        animation: none !important;
                        opacity: 1 !important;
                        transform: none !important;
                        box-shadow: none !important;
                    }
                }
            `}</style>

            <Header
                agentLabel={agentLabel}
                alertsCount={alertsCount}
                surfaceBar={surfaceBar}
                hairline={hairline}
                inkHi={inkHi}
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
                }}
            >
                <LiveMonitor
                    passRateLabel={passRateLabel}
                    passDeltaLabel={passDeltaLabel}
                    callsLabel={callsLabel}
                    errorRateLabel={errorRateLabel}
                    errorDeltaLabel={errorDeltaLabel}
                    alertsCount={alertsCount}
                    surface={surface}
                    hairline={hairline}
                    hairlineStrong={hairlineStrong}
                    inkHi={inkHi}
                    inkLo={inkLo}
                    inkDim={inkDim}
                    inkFaint={inkFaint}
                    eventGreen={eventGreen}
                    eventRed={eventRed}
                    amber={amber}
                    animate={!reducedMotion}
                />

                <Incident
                    traceId={incidentTraceId}
                    scenario={incidentScenario}
                    timestamp={incidentTimestamp}
                    surface={surface}
                    wash={wash}
                    hairline={hairline}
                    hairlineStrong={hairlineStrong}
                    inkHi={inkHi}
                    inkLo={inkLo}
                    inkDim={inkDim}
                    inkFaint={inkFaint}
                    ember={ember}
                    eventGreen={eventGreen}
                    eventRed={eventRed}
                    amber={amber}
                    violet={violet}
                    page={page}
                    animate={!reducedMotion}
                />

                <RecoveryPipeline
                    surface={surface}
                    hairline={hairline}
                    hairlineStrong={hairlineStrong}
                    inkHi={inkHi}
                    inkLo={inkLo}
                    inkDim={inkDim}
                    inkFaint={inkFaint}
                    ember={ember}
                    eventGreen={eventGreen}
                    page={page}
                    loopSeconds={loopSeconds}
                    animate={!reducedMotion}
                />
            </div>
        </div>
    )
}

/* ─── Header ────────────────────────────────────────────────── */

function Header({
    agentLabel, alertsCount,
    surfaceBar, hairline, inkHi, inkDim, ember, eventGreen,
    animate,
}: {
    agentLabel: string
    alertsCount: number
    surfaceBar: string
    hairline: string
    inkHi: string
    inkDim: string
    ember: string
    eventGreen: string
    animate: boolean
}) {
    return (
        <div
            style={{
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
            <span style={{ fontWeight: 620 }}>Continuous Monitoring</span>
            <span style={{ color: inkDim, marginLeft: 2 }}>· {agentLabel}</span>

            <span
                style={{
                    marginLeft: "auto",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                }}
            >
                <span style={{ color: inkDim }}>
                    <span style={{ color: inkHi, fontWeight: 620 }}>
                        {alertsCount}
                    </span>
                    {" "}live
                </span>
                <span style={{ position: "relative", width: 6, height: 6 }}>
                    <span
                        className="mrl-pulse-ring"
                        aria-hidden
                        style={{
                            position: "absolute",
                            inset: 0,
                            borderRadius: 999,
                            background: eventGreen,
                            animation: animate
                                ? "mrl-pulse-ring 1.8s ease-out infinite"
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
        </div>
    )
}

/* ─── Live monitor section ──────────────────────────────────── */

function LiveMonitor({
    passRateLabel, passDeltaLabel,
    callsLabel, errorRateLabel, errorDeltaLabel, alertsCount,
    surface, hairline, hairlineStrong,
    inkHi, inkLo, inkDim, inkFaint,
    eventGreen, eventRed, amber,
    animate,
}: {
    passRateLabel: string
    passDeltaLabel: string
    callsLabel: string
    errorRateLabel: string
    errorDeltaLabel: string
    alertsCount: number
    surface: string
    hairline: string
    hairlineStrong: string
    inkHi: string
    inkLo: string
    inkDim: string
    inkFaint: string
    eventGreen: string
    eventRed: string
    amber: string
    animate: boolean
}) {
    const passDeltaTone = passDeltaLabel.trim().startsWith("-") ? eventRed : eventGreen
    const errorDeltaTone = errorDeltaLabel.trim().startsWith("-") ? eventGreen : eventRed

    return (
        <motion.section
            initial={animate ? { opacity: 0, y: 4 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={
                animate
                    ? { duration: 0.3, delay: 0.08, ease: [0.215, 0.61, 0.355, 1] }
                    : { duration: 0 }
            }
            style={{
                position: "relative",
                flex: 1.4,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                padding: "12px 16px",
                boxShadow: `inset 0 -1px 0 ${hairline}`,
            }}
        >
            <SectionLabel inkDim={inkDim} inkFaint={inkFaint}>
                Live Monitor
                <span style={{ color: inkFaint }}>· prod</span>
            </SectionLabel>

            {/* Hero row: pass rate + delta + sparkline */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    alignItems: "center",
                    gap: 16,
                    flex: 1,
                    minHeight: 0,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        flexShrink: 0,
                    }}
                >
                    <span
                        style={{
                            fontFamily:
                                '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                            fontSize: 9.5,
                            color: inkDim,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            fontWeight: 620,
                            lineHeight: 1,
                        }}
                    >
                        Pass Rate
                    </span>
                    <span
                        style={{
                            display: "inline-flex",
                            alignItems: "baseline",
                            gap: 8,
                        }}
                    >
                        <span
                            style={{
                                fontFamily:
                                    '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                                fontSize: 30,
                                fontWeight: 620,
                                color: inkHi,
                                lineHeight: 1,
                                letterSpacing: "-0.02em",
                                fontVariantNumeric: "tabular-nums",
                            }}
                        >
                            {passRateLabel}
                        </span>
                        <DeltaChip label={passDeltaLabel} tone={passDeltaTone} />
                    </span>
                </div>

                <PassRateSparkline
                    values={SPARK_VALUES}
                    dipIndex={SPARK_DIP_INDEX}
                    inkFaint={inkFaint}
                    eventGreen={eventGreen}
                    eventRed={eventRed}
                    animate={animate}
                />
            </div>

            {/* Stat strip */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto 1fr auto 1fr",
                    alignItems: "center",
                    gap: 10,
                    height: 22,
                    paddingTop: 8,
                    boxShadow: `inset 0 1px 0 ${hairline}`,
                }}
            >
                <StatCell
                    label="Calls/hr"
                    value={callsLabel}
                    inkHi={inkHi}
                    inkDim={inkDim}
                />
                <StatDivider hairlineStrong={hairlineStrong} />
                <StatCell
                    label="Error"
                    value={errorRateLabel}
                    delta={errorDeltaLabel}
                    deltaTone={errorDeltaTone}
                    inkHi={inkHi}
                    inkDim={inkDim}
                />
                <StatDivider hairlineStrong={hairlineStrong} />
                <StatCell
                    label="Alerts"
                    value={String(alertsCount)}
                    inkHi={inkHi}
                    inkDim={inkDim}
                    valueTone={alertsCount > 0 ? amber : inkLo}
                />
            </div>
        </motion.section>
    )
}

function StatCell({
    label, value, delta, deltaTone, valueTone, inkHi, inkDim,
}: {
    label: string
    value: string
    delta?: string
    deltaTone?: string
    valueTone?: string
    inkHi: string
    inkDim: string
}) {
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "baseline",
                gap: 6,
                minWidth: 0,
            }}
        >
            <span
                style={{
                    fontFamily:
                        '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 9,
                    color: inkDim,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    fontWeight: 620,
                    flexShrink: 0,
                }}
            >
                {label}
            </span>
            <span
                style={{
                    fontFamily:
                        '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 12,
                    fontWeight: 620,
                    color: valueTone ?? inkHi,
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                }}
            >
                {value}
            </span>
            {delta ? (
                <span
                    style={{
                        fontFamily:
                            '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 9.5,
                        color: deltaTone,
                        fontVariantNumeric: "tabular-nums",
                        flexShrink: 0,
                    }}
                >
                    {delta}
                </span>
            ) : null}
        </span>
    )
}

function StatDivider({ hairlineStrong }: { hairlineStrong: string }) {
    return (
        <span
            aria-hidden
            style={{
                display: "inline-block",
                width: 1,
                height: 14,
                background: hairlineStrong,
            }}
        />
    )
}

function DeltaChip({ label, tone }: { label: string; tone: string }) {
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                height: 18,
                padding: "0 6px",
                borderRadius: 4,
                background: `${tone}1a`,
                boxShadow: `inset 0 0 0 1px ${tone}55`,
                color: tone,
                fontFamily:
                    '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 9.5,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
                whiteSpace: "nowrap",
            }}
        >
            {label}
        </span>
    )
}

function PassRateSparkline({
    values, dipIndex,
    inkFaint, eventGreen, eventRed,
    animate,
}: {
    values: number[]
    dipIndex: number
    inkFaint: string
    eventGreen: string
    eventRed: string
    animate: boolean
}) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [size, setSize] = useState({ w: 200, h: 56 })

    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const ro = new ResizeObserver((entries) => {
            const r = entries[0]?.contentRect
            if (r) setSize({ w: r.width, h: r.height })
        })
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    const min = Math.min(...values) - 1
    const max = Math.max(...values) + 0.5
    const range = max - min || 1

    const points = values.map((v, i) => {
        const x = (i / (values.length - 1)) * size.w
        const y = size.h - ((v - min) / range) * (size.h - 6) - 3
        return [x, y] as const
    })

    const linePath = points
        .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
        .join(" ")
    const areaPath = `${linePath} L${size.w},${size.h} L0,${size.h} Z`

    const dip = points[dipIndex]
    const last = points[points.length - 1]

    return (
        <div
            ref={containerRef}
            style={{
                position: "relative",
                width: "100%",
                height: 56,
                minWidth: 80,
            }}
        >
            <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${Math.max(1, size.w)} ${Math.max(1, size.h)}`}
                preserveAspectRatio="none"
                style={{ position: "absolute", inset: 0 }}
                aria-hidden
            >
                <motion.path
                    d={areaPath}
                    fill={eventGreen}
                    fillOpacity={0.08}
                    initial={animate ? { opacity: 0 } : false}
                    animate={{ opacity: 1 }}
                    transition={
                        animate
                            ? { duration: 0.5, delay: 0.25, ease: [0.215, 0.61, 0.355, 1] }
                            : { duration: 0 }
                    }
                />
                <motion.path
                    d={linePath}
                    fill="none"
                    stroke={eventGreen}
                    strokeWidth={1.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={animate ? { pathLength: 0 } : false}
                    animate={{ pathLength: 1 }}
                    transition={
                        animate
                            ? { duration: 0.7, delay: 0.18, ease: [0.215, 0.61, 0.355, 1] }
                            : { duration: 0 }
                    }
                />
                {dip ? (
                    <>
                        <line
                            x1={dip[0]}
                            x2={dip[0]}
                            y1={0}
                            y2={size.h}
                            stroke={eventRed}
                            strokeOpacity={0.32}
                            strokeWidth={1}
                            strokeDasharray="2 2"
                        />
                        <circle
                            cx={dip[0]}
                            cy={dip[1]}
                            r={2.8}
                            fill={eventRed}
                            stroke="rgba(0,0,0,0.4)"
                            strokeWidth={0.6}
                        />
                    </>
                ) : null}
                {last ? (
                    <circle
                        cx={last[0]}
                        cy={last[1]}
                        r={2.2}
                        fill={eventGreen}
                        stroke="rgba(0,0,0,0.4)"
                        strokeWidth={0.6}
                    />
                ) : null}
            </svg>
        </div>
    )
}

/* ─── Section label (micro mono uppercase) ─────────────────── */

function SectionLabel({
    children, inkDim,
}: {
    children: ReactNode
    inkDim: string
    inkFaint: string
}) {
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontFamily:
                    '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 9,
                color: inkDim,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 620,
                lineHeight: 1,
            }}
        >
            {children}
        </span>
    )
}

/* ─── Incident card ─────────────────────────────────────────── */

function Incident({
    traceId, scenario, timestamp,
    surface, wash, hairline, hairlineStrong,
    inkHi, inkLo, inkDim, inkFaint,
    ember, eventGreen, eventRed, amber, violet,
    page, animate,
}: {
    traceId: string
    scenario: string
    timestamp: string
    surface: string
    wash: string
    hairline: string
    hairlineStrong: string
    inkHi: string
    inkLo: string
    inkDim: string
    inkFaint: string
    ember: string
    eventGreen: string
    eventRed: string
    amber: string
    violet: string
    page: string
    animate: boolean
}) {
    return (
        <motion.section
            initial={animate ? { opacity: 0, y: 4 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={
                animate
                    ? { duration: 0.3, delay: 0.18, ease: [0.215, 0.61, 0.355, 1] }
                    : { duration: 0 }
            }
            style={{
                position: "relative",
                flex: 1.0,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: "10px 16px",
                background: wash,
                boxShadow: `inset 0 -1px 0 ${hairline}, inset 2px 0 0 ${eventRed}55`,
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexShrink: 0,
                }}
            >
                <span
                    aria-hidden
                    className={animate ? "mrl-pulse-incident" : undefined}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        background: `${eventRed}1f`,
                        color: eventRed,
                        flexShrink: 0,
                        animation: animate
                            ? "mrl-pulse-incident 1.6s ease-in-out infinite"
                            : undefined,
                    }}
                >
                    <TriangleAlertIcon size={11} strokeWidth={1.75} />
                </span>

                <SectionLabel inkDim={inkDim} inkFaint={inkFaint}>
                    Incident
                    <span style={{ color: eventRed }}>· {timestamp}</span>
                </SectionLabel>

                <span
                    style={{
                        marginLeft: "auto",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        height: 18,
                        padding: "0 6px",
                        borderRadius: 3,
                        background: `${violet}14`,
                        boxShadow: `inset 0 0 0 1px ${violet}55`,
                        color: violet,
                        fontFamily:
                            '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 9,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        fontWeight: 620,
                        lineHeight: 1,
                        whiteSpace: "nowrap",
                    }}
                >
                    flagged
                </span>
            </div>

            <div
                style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    flexShrink: 0,
                }}
            >
                <span
                    style={{
                        fontFamily:
                            '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 12,
                        color: inkHi,
                        fontWeight: 620,
                        whiteSpace: "nowrap",
                    }}
                >
                    {traceId}
                </span>
                <span
                    style={{
                        fontFamily:
                            '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 11,
                        color: amber,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        minWidth: 0,
                        flex: 1,
                    }}
                >
                    {scenario}
                </span>
            </div>

            <IncidentEventTimeline
                events={INCIDENT_EVENTS}
                hairline={hairline}
                hairlineStrong={hairlineStrong}
                inkLo={inkLo}
                inkDim={inkDim}
                inkFaint={inkFaint}
                eventGreen={eventGreen}
                amber={amber}
                eventRed={eventRed}
                page={page}
                animate={animate}
            />

            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexShrink: 0,
                    marginTop: "auto",
                }}
            >
                <span
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        color: eventGreen,
                        fontFamily:
                            '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 10,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        minWidth: 0,
                    }}
                >
                    <CheckIcon size={10} strokeWidth={2.2} />
                    captured as test case
                    <span style={{ color: inkDim }}>·</span>
                    <span style={{ color: inkLo }}>{scenario}_v3</span>
                </span>
                <span
                    style={{
                        marginLeft: "auto",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        color: ember,
                        fontFamily:
                            '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        whiteSpace: "nowrap",
                    }}
                >
                    open trace
                    <ArrowUpRightIcon size={10} strokeWidth={1.75} />
                </span>
            </div>
        </motion.section>
    )
}

function IncidentEventTimeline({
    events,
    hairline, hairlineStrong,
    inkLo, inkDim, inkFaint,
    eventGreen, amber, eventRed, page,
    animate,
}: {
    events: IncidentEvent[]
    hairline: string
    hairlineStrong: string
    inkLo: string
    inkDim: string
    inkFaint: string
    eventGreen: string
    amber: string
    eventRed: string
    page: string
    animate: boolean
}) {
    const stateColor: Record<IncidentEvent["state"], string> = {
        ok: eventGreen,
        warn: amber,
        fail: eventRed,
    }

    return (
        <div
            style={{
                position: "relative",
                flex: 1,
                minHeight: 28,
                display: "flex",
                alignItems: "center",
            }}
        >
            <span
                aria-hidden
                style={{
                    position: "absolute",
                    left: 6, right: 6,
                    top: "50%",
                    height: 1,
                    transform: "translateY(-50%)",
                    background: `linear-gradient(to right, transparent, ${hairlineStrong} 12%, ${hairlineStrong} 88%, transparent)`,
                }}
            />
            {events.map((ev, i) => {
                const c = stateColor[ev.state]
                const isFail = ev.state === "fail"
                return (
                    <motion.span
                        key={ev.id}
                        aria-hidden
                        initial={animate ? { opacity: 0, scale: 0.7 } : false}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={
                            animate
                                ? {
                                      duration: 0.32,
                                      delay: 0.36 + i * 0.08,
                                      ease: [0.215, 0.61, 0.355, 1],
                                  }
                                : { duration: 0 }
                        }
                        style={{
                            position: "absolute",
                            left: `${ev.pos}%`,
                            top: "50%",
                            width: 10,
                            height: 10,
                            marginLeft: -5,
                            marginTop: -5,
                            borderRadius: 2,
                            background: c,
                            boxShadow: isFail
                                ? `0 0 0 1px ${page}, 0 0 0 2px ${c}cc`
                                : `0 0 0 1px rgba(0, 0, 0, 0.36)`,
                        }}
                        title={ev.label}
                    />
                )
            })}
        </div>
    )
}

/* ─── Recovery pipeline (the hero) ─────────────────────────── */

function RecoveryPipeline({
    surface, hairline, hairlineStrong,
    inkHi, inkLo, inkDim, inkFaint,
    ember, eventGreen, page,
    loopSeconds, animate,
}: {
    surface: string
    hairline: string
    hairlineStrong: string
    inkHi: string
    inkLo: string
    inkDim: string
    inkFaint: string
    ember: string
    eventGreen: string
    page: string
    loopSeconds: number
    animate: boolean
}) {
    return (
        <motion.section
            initial={animate ? { opacity: 0, y: 4 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={
                animate
                    ? { duration: 0.3, delay: 0.28, ease: [0.215, 0.61, 0.355, 1] }
                    : { duration: 0 }
            }
            style={{
                position: "relative",
                flex: 1.5,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                padding: "12px 16px 16px",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexShrink: 0,
                }}
            >
                <SectionLabel inkDim={inkDim} inkFaint={inkFaint}>
                    Recovery Pipeline
                </SectionLabel>
                <span
                    style={{
                        marginLeft: "auto",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        color: ember,
                        fontFamily:
                            '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 9.5,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        fontWeight: 620,
                    }}
                >
                    <RotateIcon size={10} strokeWidth={1.75} />
                    Continuous · Autonomous
                </span>
            </div>

            <div
                style={{
                    position: "relative",
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <PipelineStages
                    stages={PIPELINE_STAGES}
                    hairline={hairline}
                    hairlineStrong={hairlineStrong}
                    inkHi={inkHi}
                    inkLo={inkLo}
                    inkDim={inkDim}
                    inkFaint={inkFaint}
                    ember={ember}
                    eventGreen={eventGreen}
                    surface={surface}
                    animate={animate}
                />

                <ReturnArrow
                    ember={ember}
                    inkFaint={inkFaint}
                    page={page}
                    loopSeconds={loopSeconds}
                    animate={animate}
                />
            </div>
        </motion.section>
    )
}

function PipelineStages({
    stages,
    hairline, hairlineStrong,
    inkHi, inkLo, inkDim, inkFaint,
    ember, eventGreen, surface,
    animate,
}: {
    stages: PipelineStage[]
    hairline: string
    hairlineStrong: string
    inkHi: string
    inkLo: string
    inkDim: string
    inkFaint: string
    ember: string
    eventGreen: string
    surface: string
    animate: boolean
}) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "stretch",
                gap: 0,
                flexShrink: 0,
            }}
        >
            {stages.map((stage, i) => (
                <Stage
                    key={stage.id}
                    stage={stage}
                    showSeparator={i < stages.length - 1}
                    surface={surface}
                    hairline={hairline}
                    hairlineStrong={hairlineStrong}
                    inkHi={inkHi}
                    inkLo={inkLo}
                    inkDim={inkDim}
                    inkFaint={inkFaint}
                    ember={ember}
                    eventGreen={eventGreen}
                    animate={animate}
                    delay={0.36 + i * 0.07}
                />
            ))}
        </div>
    )
}

function Stage({
    stage, showSeparator,
    surface, hairline, hairlineStrong,
    inkHi, inkLo, inkDim, inkFaint,
    ember, eventGreen,
    animate, delay,
}: {
    stage: PipelineStage
    showSeparator: boolean
    surface: string
    hairline: string
    hairlineStrong: string
    inkHi: string
    inkLo: string
    inkDim: string
    inkFaint: string
    ember: string
    eventGreen: string
    animate: boolean
    delay: number
}) {
    const isRunning = stage.status === "running"
    const isDone = stage.status === "done"

    const glyph: StatusGlyph =
        isDone ? "filled" : isRunning ? "half" : "dotted"
    const accent =
        isDone ? eventGreen : isRunning ? ember : inkDim
    const bg =
        isRunning ? `${ember}14` : "transparent"
    const border =
        isRunning ? `${ember}55` : hairline
    const subTone =
        isRunning ? ember : isDone ? inkLo : inkDim

    return (
        <>
            <motion.div
                initial={animate ? { opacity: 0, scale: 0.96 } : false}
                animate={{ opacity: 1, scale: 1 }}
                transition={
                    animate
                        ? {
                              duration: 0.32,
                              delay,
                              ease: [0.215, 0.61, 0.355, 1],
                          }
                        : { duration: 0 }
                }
                style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    padding: "10px 10px",
                    borderRadius: 5,
                    background: bg,
                    boxShadow: `inset 0 0 0 1px ${border}${
                        isRunning ? `, 0 0 14px ${ember}26` : ""
                    }`,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                    }}
                >
                    <span
                        aria-hidden
                        className={isRunning && animate ? "mrl-pulse-soft" : undefined}
                        style={{
                            display: "inline-flex",
                            animation: isRunning && animate
                                ? "mrl-pulse-soft 1.8s ease-in-out infinite"
                                : undefined,
                        }}
                    >
                        <StatusCircle glyph={glyph} color={accent} size={11} />
                    </span>
                    <span
                        style={{
                            fontFamily:
                                '"Inter", "Inter Variable", ui-sans-serif, system-ui, sans-serif',
                            fontSize: 11.5,
                            fontWeight: 620,
                            color: inkHi,
                            lineHeight: 1,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            minWidth: 0,
                        }}
                    >
                        {stage.label}
                    </span>
                </div>
                <span
                    style={{
                        fontFamily:
                            '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 9.5,
                        color: subTone,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        minWidth: 0,
                        marginLeft: 17,
                    }}
                    title={stage.sub}
                >
                    {stage.sub}
                </span>
            </motion.div>
            {showSeparator ? (
                <span
                    aria-hidden
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        width: 16,
                        color: inkFaint,
                    }}
                >
                    <ChevronRightIcon size={11} strokeWidth={1.5} />
                </span>
            ) : null}
        </>
    )
}

function ReturnArrow({
    ember, inkFaint, page, loopSeconds, animate,
}: {
    ember: string
    inkFaint: string
    page: string
    loopSeconds: number
    animate: boolean
}) {
    /* Curved U-arrow looping back from the bottom-right of Verify
       to the bottom-left of Detect. We use percent-based path
       coordinates inside a viewBox of 100×30 with
       preserveAspectRatio="none" so the arc spans the section width
       cleanly at any container size. The arrowhead at the end uses
       a marker so it renders correctly even when the viewBox is
       stretched horizontally. */

    /* Ember dot orbits along the curve, signalling the loop is
       continuous. Single MotionValue 0..1 maps to a parametric
       point on the bezier curve. */
    const t = useMotionValue(0)

    useEffect(() => {
        if (!animate) {
            t.set(0.0)
            return
        }
        const ctrl = animate0to1(t, Math.max(2, loopSeconds))
        return () => ctrl.stop()
    }, [animate, t, loopSeconds])

    /* Quadratic bezier control points (in viewBox space):
       P0 = (95, 0)  — right edge, top of return area
       P1 = (50, 60) — control point pulling the arc downward
       P2 = (5, 0)   — left edge, top
       Parametric form: B(s) = (1-s)^2 * P0 + 2(1-s)s * P1 + s^2 * P2 */
    const dotX = useTransform(t, (s) => {
        const k = 1 - s
        return k * k * 95 + 2 * k * s * 50 + s * s * 5
    })
    const dotY = useTransform(t, (s) => {
        const k = 1 - s
        return k * k * 0 + 2 * k * s * 60 + s * s * 0
    })

    return (
        <div
            style={{
                position: "relative",
                marginTop: 6,
                width: "100%",
                height: 30,
                flexShrink: 0,
            }}
        >
            <svg
                width="100%"
                height="100%"
                viewBox="0 0 100 30"
                preserveAspectRatio="none"
                style={{ position: "absolute", inset: 0, overflow: "visible" }}
                aria-hidden
            >
                <defs>
                    <marker
                        id="mrl-loop-arrow"
                        viewBox="0 0 10 10"
                        refX="8"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                    >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill={ember} />
                    </marker>
                </defs>

                {/* The curved return path. Drawn from Verify (right) to
                    Detect (left). Marker on the end-side renders the
                    arrowhead pointing back into Detect. */}
                <motion.path
                    d="M 95 0 Q 50 60 5 0"
                    fill="none"
                    stroke={ember}
                    strokeOpacity={0.7}
                    strokeWidth={0.6}
                    strokeLinecap="round"
                    strokeDasharray="0 1.6"
                    markerEnd="url(#mrl-loop-arrow)"
                    initial={animate ? { pathLength: 0 } : false}
                    animate={{ pathLength: 1 }}
                    transition={
                        animate
                            ? { duration: 0.6, delay: 0.6, ease: [0.215, 0.61, 0.355, 1] }
                            : { duration: 0 }
                    }
                    vectorEffect="non-scaling-stroke"
                />

                {/* Traveling dot — small ember circle that follows the
                    curve continuously. Signals "this loop is alive". */}
                <motion.circle
                    cx={dotX as unknown as number}
                    cy={dotY as unknown as number}
                    r={1.2}
                    fill={ember}
                    style={{
                        filter: `drop-shadow(0 0 2.4px ${ember})`,
                    }}
                    vectorEffect="non-scaling-stroke"
                />
            </svg>

            <span
                aria-hidden
                style={{
                    position: "absolute",
                    bottom: 0,
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontFamily:
                        '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 9,
                    color: inkFaint,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    whiteSpace: "nowrap",
                    background: page,
                    padding: "0 6px",
                }}
            >
                closes loop
            </span>
        </div>
    )
}

/* ─── Animation helper ──────────────────────────────────────── */

function animate0to1(
    motionValue: ReturnType<typeof useMotionValue<number>>,
    durationSecs: number,
) {
    return animate(motionValue, 1, {
        duration: durationSecs,
        ease: "linear",
        repeat: Infinity,
        repeatType: "loop",
    })
}

/* ─── Defaults + Framer property controls ───────────────────── */

MiniRecoveryLoop.defaultProps = {
    page:           "#0c0d10",
    surfaceBar:     "#131418",
    surface:        "#13151a",
    wash:           "rgba(239, 68, 68, 0.04)",
    hairline:       "rgba(255, 255, 255, 0.08)",
    hairlineStrong: "rgba(255, 255, 255, 0.14)",
    inkHi:          "#f7f8f8",
    ink:            "#d0d6e0",
    inkLo:          "#8a8f98",
    inkDim:         "#62666d",
    inkFaint:       "rgba(247, 248, 248, 0.40)",
    ember:          "#d8430a",
    teal:           "#2dd4bf",
    violet:         "#8b5cf6",
    amber:          "#fbbf24",
    eventGreen:     "#4ade80",
    eventRed:       "#ef4444",
    agentLabel:        "agent v4.2",
    alertsCount:       23,
    passRateLabel:     "98.2%",
    passDeltaLabel:    "-0.4pp",
    callsLabel:        "1,842",
    errorRateLabel:    "0.8%",
    errorDeltaLabel:   "+0.2pp",
    incidentTraceId:   "tr_b73x",
    incidentScenario:  "refund.race_condition",
    incidentTimestamp: "14:03:47Z",
    loopSeconds:       7,
}

addPropertyControls(MiniRecoveryLoop, {
    agentLabel: {
        type: ControlType.String,
        title: "Agent",
        defaultValue: "agent v4.2",
    },
    alertsCount: {
        type: ControlType.Number,
        title: "Alerts",
        defaultValue: 23,
        min: 0, max: 9999, step: 1,
    },
    passRateLabel: {
        type: ControlType.String,
        title: "Pass Rate",
        defaultValue: "98.2%",
    },
    passDeltaLabel: {
        type: ControlType.String,
        title: "Pass Δ",
        defaultValue: "-0.4pp",
    },
    callsLabel: {
        type: ControlType.String,
        title: "Calls/hr",
        defaultValue: "1,842",
    },
    errorRateLabel: {
        type: ControlType.String,
        title: "Error %",
        defaultValue: "0.8%",
    },
    errorDeltaLabel: {
        type: ControlType.String,
        title: "Error Δ",
        defaultValue: "+0.2pp",
    },
    incidentTraceId: {
        type: ControlType.String,
        title: "Incident Trace",
        defaultValue: "tr_b73x",
    },
    incidentScenario: {
        type: ControlType.String,
        title: "Scenario",
        defaultValue: "refund.race_condition",
    },
    incidentTimestamp: {
        type: ControlType.String,
        title: "Timestamp",
        defaultValue: "14:03:47Z",
    },
    loopSeconds: {
        type: ControlType.Number,
        title: "Loop (s)",
        defaultValue: 7,
        min: 2, max: 30, step: 0.5, unit: "s",
    },
    page:           { type: ControlType.Color, title: "Page",            defaultValue: "#0c0d10" },
    surfaceBar:     { type: ControlType.Color, title: "Surface Bar",     defaultValue: "#131418" },
    surface:        { type: ControlType.Color, title: "Surface",         defaultValue: "#13151a" },
    wash:           { type: ControlType.Color, title: "Incident Wash",   defaultValue: "rgba(239, 68, 68, 0.04)" },
    hairline:       { type: ControlType.Color, title: "Hairline",        defaultValue: "rgba(255, 255, 255, 0.08)" },
    hairlineStrong: { type: ControlType.Color, title: "Hairline Strong", defaultValue: "rgba(255, 255, 255, 0.14)" },
    inkHi:          { type: ControlType.Color, title: "Ink Hi",          defaultValue: "#f7f8f8" },
    ink:            { type: ControlType.Color, title: "Ink",             defaultValue: "#d0d6e0" },
    inkLo:          { type: ControlType.Color, title: "Ink Lo",          defaultValue: "#8a8f98" },
    inkDim:         { type: ControlType.Color, title: "Ink Dim",         defaultValue: "#62666d" },
    inkFaint:       { type: ControlType.Color, title: "Ink Faint",       defaultValue: "rgba(247, 248, 248, 0.40)" },
    ember:          { type: ControlType.Color, title: "Ember (Active)",  defaultValue: "#d8430a" },
    teal:           { type: ControlType.Color, title: "Teal",            defaultValue: "#2dd4bf" },
    violet:         { type: ControlType.Color, title: "Violet (Flag)",   defaultValue: "#8b5cf6" },
    amber:          { type: ControlType.Color, title: "Amber",           defaultValue: "#fbbf24" },
    eventGreen:     { type: ControlType.Color, title: "Pass / Done",     defaultValue: "#4ade80" },
    eventRed:       { type: ControlType.Color, title: "Critical",        defaultValue: "#ef4444" },
})

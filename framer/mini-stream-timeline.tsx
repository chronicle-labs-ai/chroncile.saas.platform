// @framerSupportedLayoutWidth: any
// @framerSupportedLayoutHeight: any
// @framerIntrinsicWidth: 560
// @framerIntrinsicHeight: 560

/**
 * Mini Stream Timeline — 1:1 port of Chronicle's `StreamTimelineViewer`
 * in its trace-highlighted state, sized for a 1:1 aspect ratio.
 *
 * Mirrors the real product surface:
 *   - Toolbar (Play / Pause / Live / Fit, Topic|Trace segmented toggle,
 *     active-trace chip in event-violet).
 *   - Axis with major + minor ticks, range bookends, ember "now-ward"
 *     accent on the right edge.
 *   - Per-source rows with company logos + per-mark trace ring
 *     (`event-violet/80`) and dim (opacity 0.18) for non-trace events.
 *   - SVG connector overlay drawing causal (solid + arrowhead) and
 *     sequential (dashed) bezier arcs between trace siblings, exactly
 *     as `stream-timeline-connectors.tsx` does.
 *   - Playhead (teal when paused, ember when live), animated via a
 *     MotionValue so the rows never re-render per frame.
 *
 * Single file, only `framer` + `framer-motion`. Icons are inline SVG
 * so there's no `lucide-react` dependency.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties, ReactNode, RefObject } from "react"
import { addPropertyControls, ControlType } from "framer"
import {
    animate,
    motion,
    useMotionTemplate,
    useMotionValue,
    useReducedMotion,
} from "framer-motion"

/* ─── Layout constants ──────────────────────────────────────── */

const LOGO_DEV_TOKEN = "pk_KUdn1PMmSYCZmOzzW8W04A"
const TOOLBAR_HEIGHT = 32
const AXIS_HEIGHT = 48
const LABEL_WIDTH = 200

const DURATION_MS = 120_000
const START_MS = 0
const END_MS = DURATION_MS

/* ─── Sources + sample data ─────────────────────────────────── */

const SOURCES = [
    "intercom",
    "stripe",
    "shopify",
    "slack",
    "zendesk",
    "hubspot",
    "salesforce",
] as const
type SourceId = (typeof SOURCES)[number]

const SOURCE_DOMAINS: Record<SourceId, string> = {
    intercom:    "intercom.com",
    stripe:      "stripe.com",
    shopify:     "shopify.com",
    slack:       "slack.com",
    zendesk:     "zendesk.com",
    hubspot:     "hubspot.com",
    salesforce:  "salesforce.com",
}

const SOURCE_LABELS: Record<SourceId, string> = {
    intercom:   "Intercom",
    stripe:     "Stripe",
    shopify:    "Shopify",
    slack:      "Slack",
    zendesk:    "Zendesk",
    hubspot:    "HubSpot",
    salesforce: "Salesforce",
}

const TRACE_ID = "trace_9F3A"
const TRACE_LABEL = "Refund flow"

interface SampleEvent {
    id: string
    source: SourceId
    type: string
    ms: number
    traceId?: string
    parentEventId?: string
}

const SAMPLE_EVENTS: SampleEvent[] = [
    { id: "ev_001", source: "intercom",   type: "page.viewed",          ms: 4_000 },
    { id: "ev_002", source: "stripe",     type: "charge.succeeded",     ms: 7_500 },
    { id: "ev_003", source: "shopify",    type: "cart.updated",         ms: 9_400 },
    { id: "ev_h1",  source: "hubspot",    type: "contact.created",      ms: 8_900 },
    { id: "ev_t1",  source: "intercom",   type: "conversation.created", ms: 12_000, traceId: TRACE_ID },
    { id: "ev_z1",  source: "zendesk",    type: "ticket.created",       ms: 14_500 },
    { id: "ev_s1",  source: "salesforce", type: "lead.created",         ms: 16_700 },
    { id: "ev_004", source: "intercom",   type: "page.viewed",          ms: 18_400 },
    { id: "ev_005", source: "shopify",    type: "product.updated",      ms: 22_800 },
    { id: "ev_t2",  source: "stripe",     type: "customer.created",     ms: 28_000, traceId: TRACE_ID, parentEventId: "ev_t1" },
    { id: "ev_h2",  source: "hubspot",    type: "deal.updated",         ms: 31_200 },
    { id: "ev_006", source: "slack",      type: "user.online",          ms: 33_000 },
    { id: "ev_z2",  source: "zendesk",    type: "ticket.replied",       ms: 36_200 },
    { id: "ev_007", source: "stripe",     type: "invoice.created",      ms: 38_500 },
    { id: "ev_008", source: "slack",      type: "channel.message",      ms: 41_400 },
    { id: "ev_t3",  source: "intercom",   type: "message.replied",      ms: 45_500, traceId: TRACE_ID, parentEventId: "ev_t2" },
    { id: "ev_s2",  source: "salesforce", type: "opportunity.updated",  ms: 47_800 },
    { id: "ev_009", source: "intercom",   type: "page.viewed",          ms: 50_200 },
    { id: "ev_010", source: "shopify",    type: "cart.updated",         ms: 56_800 },
    { id: "ev_t4",  source: "shopify",    type: "order.created",        ms: 62_000, traceId: TRACE_ID, parentEventId: "ev_t3" },
    { id: "ev_h3",  source: "hubspot",    type: "email.opened",         ms: 64_500 },
    { id: "ev_011", source: "slack",      type: "channel.message",      ms: 68_500 },
    { id: "ev_012", source: "stripe",     type: "charge.succeeded",     ms: 74_800 },
    { id: "ev_z3",  source: "zendesk",    type: "ticket.escalated",     ms: 78_400 },
    { id: "ev_013", source: "intercom",   type: "page.viewed",          ms: 79_000 },
    { id: "ev_t5",  source: "slack",      type: "notify.sent",          ms: 82_000, traceId: TRACE_ID, parentEventId: "ev_t4" },
    { id: "ev_014", source: "shopify",    type: "order.updated",        ms: 88_500 },
    { id: "ev_s3",  source: "salesforce", type: "account.merged",       ms: 89_500 },
    { id: "ev_015", source: "intercom",   type: "conversation.replied", ms: 93_700 },
    { id: "ev_h4",  source: "hubspot",    type: "meeting.booked",       ms: 96_300 },
    { id: "ev_016", source: "stripe",     type: "payout.created",       ms: 102_000 },
    { id: "ev_017", source: "slack",      type: "user.offline",         ms: 108_400 },
    { id: "ev_018", source: "shopify",    type: "order.fulfilled",      ms: 114_200 },
]

const TRACE_SIBLING_IDS = new Set(
    SAMPLE_EVENTS.filter((e) => e.traceId === TRACE_ID).map((e) => e.id),
)

/* ─── Tick math (mirrors `tick-format.ts`) ──────────────────── */

interface Tick { kind: "major" | "minor"; ms: number }

function getTickIntervalSeconds(durationMs: number): number {
    const secs = durationMs / 1000
    if (secs <= 60)   return 10
    if (secs <= 300)  return 30
    if (secs <= 1800) return 60
    return 600
}

function getMinorSubdivisions(durationMs: number): number {
    const secs = durationMs / 1000
    if (secs <= 60)   return 2
    if (secs <= 300)  return 3
    if (secs <= 1800) return 4
    return 5
}

function computeTicks(startMs: number, endMs: number): Tick[] {
    const durationMs = endMs - startMs
    const majorMs = getTickIntervalSeconds(durationMs) * 1000
    const minorMs = majorMs / getMinorSubdivisions(durationMs)
    const out: Tick[] = []
    const first = Math.floor(startMs / minorMs) * minorMs + minorMs
    for (let t = first; t <= endMs; t += minorMs) {
        const isMajor = Math.abs(t % majorMs) < 0.5
        out.push({ kind: isMajor ? "major" : "minor", ms: t })
    }
    return out
}

function pad(n: number) { return String(n).padStart(2, "0") }

function formatTick(durationSecs: number, ms: number): string {
    const baseHour = 14
    const totalSecs = Math.floor(ms / 1000)
    const totalMin = baseHour * 60 + Math.floor(totalSecs / 60)
    const h = Math.floor(totalMin / 60)
    const min = totalMin % 60
    const sec = totalSecs % 60
    if (durationSecs <= 60)   return pad(sec)
    if (durationSecs <= 1800) return `${pad(min)}:${pad(sec)}`
    return `${pad(h)}:${pad(min)}`
}

function formatBookend(ms: number): string {
    const totalSecs = Math.floor(ms / 1000)
    const totalMin = 14 * 60 + Math.floor(totalSecs / 60)
    return `${pad(Math.floor(totalMin / 60))}:${pad(totalMin % 60)}`
}

function timeToX(ms: number, width: number): number {
    return ((ms - START_MS) / DURATION_MS) * width
}

/* ─── Trace edge math (mirrors `trace.ts buildTraceEdges`) ─── */

interface TraceEdge {
    id: string
    fromId: string
    toId: string
    kind: "causal" | "sequential"
}

function buildTraceEdges(sortedEvents: SampleEvent[]): TraceEdge[] {
    if (sortedEvents.length < 2) return []
    const ids = new Set(sortedEvents.map((e) => e.id))
    const out: TraceEdge[] = []
    let prev: SampleEvent | null = null
    for (const e of sortedEvents) {
        if (e.parentEventId && ids.has(e.parentEventId)) {
            out.push({
                id: `c_${e.parentEventId}_${e.id}`,
                fromId: e.parentEventId,
                toId: e.id,
                kind: "causal",
            })
        } else if (prev) {
            out.push({
                id: `s_${prev.id}_${e.id}`,
                fromId: prev.id,
                toId: e.id,
                kind: "sequential",
            })
        }
        prev = e
    }
    return out
}

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

const PlayIcon = (p: IconProps) => (
    <Icon {...p}>
        <polygon points="5 3 19 12 5 21" fill="currentColor" stroke="none" />
    </Icon>
)
const PauseIcon = (p: IconProps) => (
    <Icon {...p} strokeWidth={p.strokeWidth ?? 2}>
        <rect x="6" y="4" width="4" height="16" rx="0.5" fill="currentColor" stroke="none" />
        <rect x="14" y="4" width="4" height="16" rx="0.5" fill="currentColor" stroke="none" />
    </Icon>
)
const Maximize2Icon = (p: IconProps) => (
    <Icon {...p}>
        <polyline points="15 3 21 3 21 9" />
        <polyline points="9 21 3 21 3 15" />
        <line x1="21" y1="3" x2="14" y2="10" />
        <line x1="3" y1="21" x2="10" y2="14" />
    </Icon>
)
const GitBranchIcon = (p: IconProps) => (
    <Icon {...p}>
        <line x1="6" y1="3" x2="6" y2="15" />
        <circle cx="18" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M18 9a9 9 0 0 1-9 9" />
    </Icon>
)
const XIcon = (p: IconProps) => (
    <Icon {...p}>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </Icon>
)
const ChevronDownIcon = (p: IconProps) => (
    <Icon {...p}>
        <polyline points="6 9 12 15 18 9" />
    </Icon>
)
/* ─── Theme tokens (exposed as Framer props) ─────────────────── */

interface Theme {
    page: string
    surfaceBar: string
    surfaceBar2: string
    surface: string
    surfaceHover: string
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
    eventRed: string
}

interface Props extends Theme {
    intercomColor: string
    stripeColor: string
    shopifyColor: string
    slackColor: string
    zendeskColor: string
    hubspotColor: string
    salesforceColor: string
    showConnectors: boolean
    activeTraceHighlight: boolean
    playback: "live" | "playing" | "paused"
    loopSeconds: number
}

/* ─── Top-level component ───────────────────────────────────── */

export default function MiniStreamTimeline(props: Props) {
    const {
        page, surfaceBar, surfaceBar2, surface,
        hairline, hairlineStrong,
        inkHi, ink, inkLo, inkDim, inkFaint,
        ember, teal, violet, eventRed,
        intercomColor, stripeColor, shopifyColor, slackColor,
        zendeskColor, hubspotColor, salesforceColor,
        showConnectors, activeTraceHighlight,
        playback, loopSeconds,
    } = props

    const reducedMotion = useReducedMotion()
    const timeAreaRef = useRef<HTMLDivElement | null>(null)
    const rowsContainerRef = useRef<HTMLDivElement | null>(null)
    const [timeAreaWidth, setTimeAreaWidth] = useState(360)
    const [rowsContainerHeight, setRowsContainerHeight] = useState(280)

    useEffect(() => {
        const el = timeAreaRef.current
        if (!el) return
        const ro = new ResizeObserver((entries) => {
            const w = entries[0]?.contentRect.width ?? 360
            setTimeAreaWidth(w)
        })
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    useEffect(() => {
        const el = rowsContainerRef.current
        if (!el) return
        const ro = new ResizeObserver((entries) => {
            const h = entries[0]?.contentRect.height ?? 280
            setRowsContainerHeight(h)
        })
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    /* Per-row event lists. */
    const eventsBySource = useMemo(() => {
        const map = Object.fromEntries(SOURCES.map((s) => [s, [] as SampleEvent[]])) as Record<SourceId, SampleEvent[]>
        for (const e of SAMPLE_EVENTS) map[e.source].push(e)
        for (const k of SOURCES) map[k].sort((a, b) => a.ms - b.ms)
        return map
    }, [])

    const sourceColorMap: Record<SourceId, string> = {
        intercom:   intercomColor,
        stripe:     stripeColor,
        shopify:    shopifyColor,
        slack:      slackColor,
        zendesk:    zendeskColor,
        hubspot:    hubspotColor,
        salesforce: salesforceColor,
    }

    /* Trace edges (causal + sequential). */
    const traceSorted = useMemo(
        () => SAMPLE_EVENTS
            .filter((e) => e.traceId === TRACE_ID)
            .sort((a, b) => a.ms - b.ms),
        [],
    )
    const edges = useMemo(() => buildTraceEdges(traceSorted), [traceSorted])

    /* Playhead — MotionValue so rows never re-render per frame. */
    const playheadX = useMotionValue(0)
    useEffect(() => {
        if (reducedMotion || playback === "paused") {
            playheadX.set(70)
            return
        }
        const controls = animate(playheadX, [0, 100], {
            duration: Math.max(4, loopSeconds),
            repeat: Infinity,
            repeatType: "loop",
            ease: "linear",
        })
        return () => controls.stop()
    }, [reducedMotion, playback, loopSeconds, playheadX])

    const playheadColor = playback === "paused" ? teal : ember
    const playheadLeft = useMotionTemplate`${playheadX}%`

    const ticks = useMemo(() => computeTicks(START_MS, END_MS), [])
    const majorTicks = useMemo(
        () => ticks.filter((t) => t.kind === "major"),
        [ticks],
    )
    const durationSecs = DURATION_MS / 1000
    const traceActive = activeTraceHighlight
    const rowHeight = rowsContainerHeight / SOURCES.length

    return (
        <div
            role="img"
            aria-label="Stream timeline showing seven event sources with trace_9F3A highlighted across them"
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
                @keyframes mst-pulse {
                    0%, 100% { opacity: 1; }
                    50%      { opacity: 0.35; }
                }
                @media (prefers-reduced-motion: reduce) {
                    .mst-pulse { animation: none !important; opacity: 1 !important; }
                }
            `}</style>

            <Toolbar
                playback={playback}
                surfaceBar={surfaceBar}
                surfaceBar2={surfaceBar2}
                hairline={hairline}
                hairlineStrong={hairlineStrong}
                inkHi={inkHi}
                inkLo={inkLo}
                ember={ember}
                violet={violet}
                eventRed={eventRed}
                showTrace={traceActive}
            />

            <Axis
                ticks={ticks}
                durationSecs={durationSecs}
                timeAreaWidth={timeAreaWidth}
                timeAreaRef={timeAreaRef}
                surfaceBar2={surfaceBar2}
                hairline={hairline}
                hairlineStrong={hairlineStrong}
                ember={ember}
                inkLo={inkLo}
                inkDim={inkDim}
                inkFaint={inkFaint}
                streamCount={SOURCES.length}
            />

            <div
                ref={rowsContainerRef}
                style={{
                    position: "relative",
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    background: page,
                }}
            >
                {/* Major-tick guidelines (behind rows). */}
                <div
                    aria-hidden
                    style={{
                        position: "absolute",
                        top: 0, bottom: 0,
                        left: LABEL_WIDTH, right: 0,
                        pointerEvents: "none",
                    }}
                >
                    {majorTicks.map((tick) => {
                        const x = timeToX(tick.ms, timeAreaWidth)
                        if (x < 0 || x > timeAreaWidth) return null
                        return (
                            <span
                                key={tick.ms}
                                style={{
                                    position: "absolute",
                                    top: 0, bottom: 0,
                                    left: x,
                                    width: 1,
                                    background: hairline,
                                    opacity: 0.6,
                                }}
                            />
                        )
                    })}
                </div>

                {SOURCES.map((source, idx) => (
                    <Row
                        key={source}
                        source={source}
                        index={idx}
                        events={eventsBySource[source]}
                        color={sourceColorMap[source]}
                        timeAreaWidth={timeAreaWidth}
                        traceActive={traceActive}
                        page={page}
                        surface={surface}
                        hairline={hairline}
                        inkHi={inkHi}
                        inkDim={inkDim}
                        violet={violet}
                    />
                ))}

                {/* Connector arcs overlay. */}
                {showConnectors && timeAreaWidth > 0 && rowHeight > 0 ? (
                    <Connectors
                        edges={edges}
                        events={SAMPLE_EVENTS}
                        timeAreaWidth={timeAreaWidth}
                        rowHeight={rowHeight}
                        violet={violet}
                    />
                ) : null}

                {/* Single playhead overlay spanning all rows. */}
                <div
                    aria-hidden
                    style={{
                        position: "absolute",
                        top: 0, bottom: 0,
                        left: LABEL_WIDTH, right: 0,
                        pointerEvents: "none",
                    }}
                >
                    <motion.div
                        style={{
                            position: "absolute",
                            top: 0, bottom: 0,
                            left: playheadLeft,
                            marginLeft: -1,
                            width: 2,
                            background: playheadColor,
                            opacity: 0.92,
                        }}
                    />
                </div>
            </div>
        </div>
    )
}

/* ─── Toolbar ───────────────────────────────────────────────── */

function Toolbar({
    playback,
    surfaceBar, surfaceBar2, hairline, hairlineStrong,
    inkHi, inkLo, ember, violet, eventRed,
    showTrace,
}: {
    playback: "live" | "playing" | "paused"
    surfaceBar: string
    surfaceBar2: string
    hairline: string
    hairlineStrong: string
    inkHi: string
    inkLo: string
    ember: string
    violet: string
    eventRed: string
    showTrace: boolean
}) {
    const isPlaying = playback === "playing"
    const isLive = playback === "live"

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                height: TOOLBAR_HEIGHT,
                flexShrink: 0,
                padding: "0 8px",
                background: surfaceBar,
                boxShadow: `inset 0 -1px 0 ${hairline}`,
                color: inkLo,
                fontSize: 12,
                lineHeight: 1,
                minWidth: 0,
            }}
        >
            <PlayerIconButton
                active={isPlaying}
                ariaLabel={isPlaying ? "Pause" : "Play"}
                inkHi={inkHi}
                inkLo={inkLo}
                hairlineStrong={hairlineStrong}
                surfaceBar2={surfaceBar2}
            >
                {isPlaying ? <PauseIcon size={11} /> : <PlayIcon size={11} />}
            </PlayerIconButton>

            <PlayerButton
                active={isLive}
                tone={isLive ? "ember" : "neutral"}
                ember={ember}
                inkHi={inkHi}
                inkLo={inkLo}
                hairlineStrong={hairlineStrong}
                surfaceBar2={surfaceBar2}
                icon={
                    <span
                        aria-hidden
                        className={isLive ? "mst-pulse" : undefined}
                        style={{
                            display: "inline-block",
                            width: 6, height: 6,
                            borderRadius: 999,
                            background: isLive ? eventRed : "currentColor",
                            opacity: isLive ? 1 : 0.5,
                            animation: isLive
                                ? "mst-pulse 1.6s ease-in-out infinite"
                                : undefined,
                        }}
                    />
                }
                label="Live"
            />

            <PlayerIconButton
                ariaLabel="Fit to window"
                inkHi={inkHi}
                inkLo={inkLo}
                hairlineStrong={hairlineStrong}
                surfaceBar2={surfaceBar2}
            >
                <Maximize2Icon size={11} />
            </PlayerIconButton>

            {showTrace ? (
                <div style={{ marginLeft: "auto", minWidth: 0, display: "flex" }}>
                    <TraceChip violet={violet} />
                </div>
            ) : null}
        </div>
    )
}

function PlayerIconButton({
    children, ariaLabel, active,
    inkHi, inkLo, hairlineStrong, surfaceBar2,
}: {
    children: ReactNode
    ariaLabel: string
    active?: boolean
    inkHi: string
    inkLo: string
    hairlineStrong: string
    surfaceBar2: string
}) {
    return (
        <button
            type="button"
            aria-label={ariaLabel}
            aria-pressed={active}
            style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 24, height: 24,
                padding: 0,
                borderRadius: 6,
                border: `1px solid ${active ? hairlineStrong : "transparent"}`,
                background: active ? surfaceBar2 : "transparent",
                color: active ? inkHi : inkLo,
                cursor: "default",
                flexShrink: 0,
            }}
        >
            {children}
        </button>
    )
}

function PlayerButton({
    icon, label, active, tone = "neutral",
    inkHi, inkLo, hairlineStrong, surfaceBar2, ember,
}: {
    icon?: ReactNode
    label?: ReactNode
    active?: boolean
    tone?: "neutral" | "ember"
    inkHi: string
    inkLo: string
    hairlineStrong: string
    surfaceBar2: string
    ember?: string
}) {
    const isEmber = tone === "ember"
    const activeBg = isEmber ? "rgba(216, 67, 10, 0.10)" : surfaceBar2
    const activeBorder = isEmber ? "rgba(216, 67, 10, 0.35)" : hairlineStrong
    const activeColor = isEmber ? ember ?? inkHi : inkHi

    return (
        <button
            type="button"
            aria-pressed={active}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                height: 24,
                padding: "0 8px",
                borderRadius: 6,
                border: `1px solid ${active ? activeBorder : "transparent"}`,
                background: active ? activeBg : "transparent",
                color: active ? activeColor : inkLo,
                fontSize: 12,
                fontWeight: 500,
                lineHeight: 1,
                cursor: "default",
                whiteSpace: "nowrap",
            }}
        >
            {icon}
            {label}
        </button>
    )
}

function TraceChip({ violet }: { violet: string }) {
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                height: 22,
                padding: "0 7px",
                borderRadius: 6,
                border: `1px solid ${violet}4d`,
                background: `${violet}14`,
                color: violet,
                fontSize: 11.5,
                lineHeight: 1,
                whiteSpace: "nowrap",
            }}
        >
            <GitBranchIcon size={10} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>
                {TRACE_LABEL}
            </span>
            <span
                style={{
                    fontFamily:
                        '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 10.5,
                    color: `${violet}b3`,
                }}
            >
                · {TRACE_SIBLING_IDS.size}
            </span>
            <button
                type="button"
                aria-label="Clear active trace"
                style={{
                    marginLeft: 2,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 14, height: 14,
                    borderRadius: 3,
                    border: "none",
                    background: "transparent",
                    color: `${violet}b3`,
                    cursor: "default",
                }}
            >
                <XIcon size={10} />
            </button>
        </span>
    )
}

/* ─── Axis ──────────────────────────────────────────────────── */

function Axis({
    ticks, durationSecs, timeAreaWidth, timeAreaRef,
    surfaceBar2, hairline, hairlineStrong, ember,
    inkLo, inkDim, inkFaint, streamCount,
}: {
    ticks: Tick[]
    durationSecs: number
    timeAreaWidth: number
    timeAreaRef: RefObject<HTMLDivElement | null>
    surfaceBar2: string
    hairline: string
    hairlineStrong: string
    ember: string
    inkLo: string
    inkDim: string
    inkFaint: string
    streamCount: number
}) {
    return (
        <div
            style={{
                display: "flex",
                height: AXIS_HEIGHT,
                flexShrink: 0,
                background: surfaceBar2,
                boxShadow: `inset 0 -1px 0 ${hairline}`,
            }}
        >
            <div
                style={{
                    position: "relative",
                    width: LABEL_WIDTH,
                    flexShrink: 0,
                    boxShadow: `inset -1px 0 0 ${hairline}`,
                    padding: "6px 12px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                }}
            >
                <span
                    style={{
                        fontFamily:
                            '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: inkDim,
                    }}
                >
                    Streams
                    <span style={{ marginLeft: 4, color: inkFaint }}>({streamCount})</span>
                </span>
                <span
                    style={{
                        fontFamily:
                            '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 9,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: inkFaint,
                    }}
                >
                    {formatBookend(START_MS)}
                </span>
            </div>

            <div
                ref={timeAreaRef}
                style={{
                    position: "relative",
                    flex: 1,
                    height: "100%",
                    cursor: "grab",
                }}
            >
                <span
                    aria-hidden
                    style={{
                        position: "absolute",
                        left: 0, right: 0, bottom: 0,
                        height: 1,
                        background: hairlineStrong,
                    }}
                />
                <span
                    aria-hidden
                    style={{
                        position: "absolute",
                        right: 0, bottom: 0,
                        height: 1, width: 48,
                        background: `linear-gradient(to left, ${ember}66, transparent)`,
                    }}
                />

                {ticks.map((tick) => {
                    const x = timeToX(tick.ms, timeAreaWidth)
                    if (x < -8 || x > timeAreaWidth + 8) return null
                    if (tick.kind === "major") {
                        return (
                            <span key={`maj_${tick.ms}`}>
                                <span
                                    aria-hidden
                                    style={{
                                        position: "absolute",
                                        bottom: 0,
                                        left: x,
                                        width: 1, height: 8,
                                        background: `${inkDim}b3`,
                                    }}
                                />
                                <span
                                    style={{
                                        position: "absolute",
                                        top: 6,
                                        left: x,
                                        transform: "translateX(-50%)",
                                        fontFamily:
                                            '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                                        fontSize: 9,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.06em",
                                        color: inkLo,
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {formatTick(durationSecs, tick.ms)}
                                </span>
                            </span>
                        )
                    }
                    return (
                        <span
                            key={`min_${tick.ms}`}
                            aria-hidden
                            style={{
                                position: "absolute",
                                bottom: 0,
                                left: x,
                                width: 1, height: 4,
                                background: `${inkDim}4d`,
                            }}
                        />
                    )
                })}
            </div>
        </div>
    )
}

/* ─── Row ───────────────────────────────────────────────────── */

function Row({
    source, index, events, color, timeAreaWidth,
    traceActive, page, surface, hairline,
    inkHi, inkDim, violet,
}: {
    source: SourceId
    index: number
    events: SampleEvent[]
    color: string
    timeAreaWidth: number
    traceActive: boolean
    page: string
    surface: string
    hairline: string
    inkHi: string
    inkDim: string
    violet: string
}) {
    const sourceLabel = SOURCE_LABELS[source]
    const eventCount = events.length
    const isLast = index === SOURCES.length - 1

    return (
        <div
            style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                flex: 1,
                minHeight: 0,
                boxShadow: !isLast ? `inset 0 -1px 0 ${hairline}` : undefined,
                background: index % 2 === 0 ? "transparent" : `${surface}66`,
            }}
        >
            <div
                style={{
                    position: "relative",
                    zIndex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexShrink: 0,
                    width: LABEL_WIDTH,
                    height: "100%",
                    padding: "0 8px",
                    background: page,
                    boxShadow: `inset -1px 0 0 ${hairline}`,
                }}
            >
                <span style={{ width: 16, height: 16 }} aria-hidden>
                    <ChevronDownIcon size={12} style={{ color: inkDim }} />
                </span>
                <CompanyLogo source={source} color={color} />
                <span
                    style={{
                        fontFamily:
                            '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 11,
                        color: inkHi,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {sourceLabel}
                    <span style={{ color: inkDim }}> /</span>
                </span>
                <span
                    style={{
                        marginLeft: "auto",
                        fontFamily:
                            '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 9,
                        color: inkDim,
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {eventCount}
                </span>
            </div>

            <div style={{ position: "relative", flex: 1, height: "100%" }}>
                {events.map((ev) => {
                    const x = timeToX(ev.ms, timeAreaWidth)
                    if (x < -10 || x > timeAreaWidth + 10) return null
                    const inTrace = TRACE_SIBLING_IDS.has(ev.id)
                    const dimmed = traceActive && !inTrace
                    const width = 8
                    const heightPct = inTrace ? 64 : 56
                    const opacity = dimmed ? 0.18 : 1
                    return (
                        <span
                            key={ev.id}
                            aria-label={`${sourceLabel} ${ev.type}`}
                            title={`${ev.type} · ${formatBookend(ev.ms)}`}
                            style={{
                                position: "absolute",
                                top: "50%",
                                left: x - width / 2,
                                width,
                                height: `${heightPct}%`,
                                maxHeight: inTrace ? 24 : 22,
                                minHeight: inTrace ? 14 : 12,
                                transform: "translateY(-50%)",
                                borderRadius: 2,
                                background: color,
                                opacity,
                                boxShadow:
                                    inTrace && traceActive
                                        ? `0 0 0 1px ${page}, 0 0 0 2px ${violet}cc`
                                        : "0 0 0 1px rgba(0, 0, 0, 0.36)",
                                transition:
                                    "opacity 200ms ease, height 200ms ease",
                            }}
                        />
                    )
                })}
            </div>
        </div>
    )
}

const SOURCE_LOGO_FALLBACK_TONE: Record<SourceId, string> = {
    intercom:   "rgba(45, 212, 191, 0.22)",
    stripe:     "rgba(74, 222, 128, 0.22)",
    shopify:    "rgba(251, 191, 36, 0.22)",
    slack:      "rgba(244, 114, 182, 0.22)",
    zendesk:    "rgba(62, 84, 124, 0.32)",
    hubspot:    "rgba(216, 107, 61, 0.22)",
    salesforce: "rgba(112, 145, 136, 0.28)",
}

function CompanyLogo({ source, color }: { source: SourceId; color: string }) {
    const [failed, setFailed] = useState(false)
    const size = 16
    const src = `https://img.logo.dev/${SOURCE_DOMAINS[source]}?token=${LOGO_DEV_TOKEN}&size=${
        size * 2
    }&format=webp`

    if (failed) {
        return (
            <span
                aria-hidden
                style={{
                    display: "inline-flex",
                    width: size, height: size,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 3,
                    background: SOURCE_LOGO_FALLBACK_TONE[source],
                    color,
                    fontSize: 9,
                    fontWeight: 700,
                    flexShrink: 0,
                }}
            >
                {SOURCE_LABELS[source][0]}
            </span>
        )
    }

    return (
        <img
            alt=""
            aria-hidden
            src={src}
            width={size}
            height={size}
            onError={() => setFailed(true)}
            loading="lazy"
            style={{
                width: size, height: size,
                borderRadius: 3,
                flexShrink: 0,
                display: "block",
            }}
        />
    )
}

/* ─── Connector arcs (SVG bezier overlay) ──────────────────── */

function Connectors({
    edges, events, timeAreaWidth, rowHeight, violet,
}: {
    edges: TraceEdge[]
    events: SampleEvent[]
    timeAreaWidth: number
    rowHeight: number
    violet: string
}) {
    const eventById = useMemo(() => {
        const m = new Map<string, SampleEvent>()
        for (const e of events) m.set(e.id, e)
        return m
    }, [events])

    const rowIndexBySource: Record<SourceId, number> = useMemo(
        () => Object.fromEntries(SOURCES.map((s, i) => [s, i])) as Record<SourceId, number>,
        [],
    )

    const totalHeight = SOURCES.length * rowHeight

    const paths = useMemo(() => {
        const out: Array<{ key: string; d: string; kind: TraceEdge["kind"] }> = []
        for (const edge of edges) {
            const fromEv = eventById.get(edge.fromId)
            const toEv = eventById.get(edge.toId)
            if (!fromEv || !toEv) continue
            const fromRow = rowIndexBySource[fromEv.source]
            const toRow = rowIndexBySource[toEv.source]
            const x1 = timeToX(fromEv.ms, timeAreaWidth)
            const x2 = timeToX(toEv.ms, timeAreaWidth)
            const y1 = fromRow * rowHeight + rowHeight / 2
            const y2 = toRow * rowHeight + rowHeight / 2
            const dx = x2 - x1
            const sameRow = fromRow === toRow
            let d: string
            if (sameRow) {
                const bow = -Math.min(rowHeight * 0.3, Math.abs(dx) * 0.06)
                const midX = (x1 + x2) / 2
                const midY = y1 + bow
                d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${midX.toFixed(1)} ${midY.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`
            } else {
                const c1x = x1 + dx * 0.35
                const c2x = x1 + dx * 0.65
                d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${c1x.toFixed(1)} ${y1.toFixed(1)}, ${c2x.toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`
            }
            out.push({ key: edge.id, d, kind: edge.kind })
        }
        return out
    }, [edges, eventById, rowIndexBySource, rowHeight, timeAreaWidth])

    if (paths.length === 0 || timeAreaWidth <= 0 || totalHeight <= 0) return null

    return (
        <svg
            aria-hidden
            style={{
                position: "absolute",
                top: 0,
                left: LABEL_WIDTH,
                width: timeAreaWidth,
                height: totalHeight,
                pointerEvents: "none",
                overflow: "visible",
            }}
            viewBox={`0 0 ${Math.max(1, timeAreaWidth)} ${Math.max(1, totalHeight)}`}
            preserveAspectRatio="none"
        >
            <defs>
                <marker
                    id="mst-arrow"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill={violet} />
                </marker>
            </defs>
            {paths.map((p) => (
                <path
                    key={p.key}
                    d={p.d}
                    fill="none"
                    stroke={violet}
                    strokeWidth={p.kind === "causal" ? 1.75 : 1.25}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeOpacity={0.85}
                    strokeDasharray={p.kind === "causal" ? "0 4" : "0 5"}
                    markerEnd={p.kind === "causal" ? "url(#mst-arrow)" : undefined}
                />
            ))}
        </svg>
    )
}

/* ─── Defaults + Framer property controls ───────────────────── */

MiniStreamTimeline.defaultProps = {
    page:           "#0c0d10",
    surfaceBar:     "#131418",
    surfaceBar2:    "#191a1f",
    surface:        "#13151a",
    surfaceHover:   "rgba(255, 255, 255, 0.04)",
    hairline:       "rgba(255, 255, 255, 0.10)",
    hairlineStrong: "rgba(255, 255, 255, 0.16)",
    inkHi:          "#f7f8f8",
    ink:            "#d0d6e0",
    inkLo:          "#8a8f98",
    inkDim:         "#62666d",
    inkFaint:       "rgba(247, 248, 248, 0.35)",
    ember:          "#d8430a",
    teal:           "#2dd4bf",
    violet:         "#8b5cf6",
    eventRed:       "#ef4444",
    intercomColor:   "#2dd4bf",
    stripeColor:     "#4ade80",
    shopifyColor:    "#fbbf24",
    slackColor:      "#f472b6",
    zendeskColor:    "#3e547c",
    hubspotColor:    "#d86b3d",
    salesforceColor: "#709188",
    showConnectors: true,
    activeTraceHighlight: true,
    playback:       "live",
    loopSeconds:    14,
}

addPropertyControls(MiniStreamTimeline, {
    activeTraceHighlight: {
        type: ControlType.Boolean,
        title: "Trace Highlight",
        defaultValue: true,
    },
    showConnectors: {
        type: ControlType.Boolean,
        title: "Connectors",
        defaultValue: true,
    },
    playback: {
        type: ControlType.Enum,
        title: "Playback",
        options: ["live", "playing", "paused"],
        optionTitles: ["Live", "Playing", "Paused"],
        defaultValue: "live",
    },
    loopSeconds: {
        type: ControlType.Number,
        title: "Loop (s)",
        defaultValue: 14, min: 4, max: 40, step: 0.5, unit: "s",
    },
    page:            { type: ControlType.Color, title: "Page",            defaultValue: "#0c0d10" },
    surfaceBar:      { type: ControlType.Color, title: "Surface Bar",     defaultValue: "#131418" },
    surfaceBar2:     { type: ControlType.Color, title: "Surface Bar 2",   defaultValue: "#191a1f" },
    surface:         { type: ControlType.Color, title: "Surface",         defaultValue: "#13151a" },
    surfaceHover:    { type: ControlType.Color, title: "Surface Hover",   defaultValue: "rgba(255, 255, 255, 0.04)" },
    hairline:        { type: ControlType.Color, title: "Hairline",        defaultValue: "rgba(255, 255, 255, 0.10)" },
    hairlineStrong:  { type: ControlType.Color, title: "Hairline Strong", defaultValue: "rgba(255, 255, 255, 0.16)" },
    inkHi:           { type: ControlType.Color, title: "Ink Hi",          defaultValue: "#f7f8f8" },
    ink:             { type: ControlType.Color, title: "Ink",             defaultValue: "#d0d6e0" },
    inkLo:           { type: ControlType.Color, title: "Ink Lo",          defaultValue: "#8a8f98" },
    inkDim:          { type: ControlType.Color, title: "Ink Dim",         defaultValue: "#62666d" },
    inkFaint:        { type: ControlType.Color, title: "Ink Faint",       defaultValue: "rgba(247, 248, 248, 0.35)" },
    ember:           { type: ControlType.Color, title: "Ember",           defaultValue: "#d8430a" },
    teal:            { type: ControlType.Color, title: "Teal",            defaultValue: "#2dd4bf" },
    violet:          { type: ControlType.Color, title: "Violet (Trace)",  defaultValue: "#8b5cf6" },
    eventRed:        { type: ControlType.Color, title: "Live Dot",        defaultValue: "#ef4444" },
    intercomColor:   { type: ControlType.Color, title: "Intercom",        defaultValue: "#2dd4bf" },
    stripeColor:     { type: ControlType.Color, title: "Stripe",          defaultValue: "#4ade80" },
    shopifyColor:    { type: ControlType.Color, title: "Shopify",         defaultValue: "#fbbf24" },
    slackColor:      { type: ControlType.Color, title: "Slack",           defaultValue: "#f472b6" },
    zendeskColor:    { type: ControlType.Color, title: "Zendesk",         defaultValue: "#3e547c" },
    hubspotColor:    { type: ControlType.Color, title: "HubSpot",         defaultValue: "#d86b3d" },
    salesforceColor: { type: ControlType.Color, title: "Salesforce",      defaultValue: "#709188" },
})

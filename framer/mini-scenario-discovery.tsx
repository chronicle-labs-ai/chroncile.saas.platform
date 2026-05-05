// @framerSupportedLayoutWidth: any
// @framerSupportedLayoutHeight: any
// @framerIntrinsicWidth: 560
// @framerIntrinsicHeight: 560

/**
 * Mini Scenario Discovery — Linear-density Chronicle list view.
 *
 * Reads as a real Linear product surface: flat list, hairline dividers
 * between regions, no panel/card chrome around the list. Top-to-bottom:
 *
 *   1. HEADER strip (32px) — sparkles glyph + "Scenario Discovery"
 *      eyebrow, live pulse + total count on the right.
 *   2. WORKFLOW path strip (24px) — single-line text breadcrumb of the
 *      reconstructed workflow steps. All nodes ink-lo monospace; the
 *      focal step gets ink-hi + a leading ember dot.
 *   3. FILTER bar (28px) — Linear-style filter pills: `Status · All`,
 *      `Source · All`, `Sort · Last seen`, then a `+` filter affordance
 *      and the total count on the right.
 *   4. LIST — collapsible group sections (Captured / Adjacent /
 *      Emerging / Edge). Group headers sit on a thin wash of their tone
 *      and carry a chevron, count, and short description. Rows below
 *      each group are 28px tall and follow the canonical Chronicle
 *      list pattern: status glyph (circular progress per bucket),
 *      mono trace key, sans label, source-letter stack, mono
 *      `count · time` metadata, trailing chevron.
 *
 * Linear cues applied:
 *   - Circular-progress status glyphs (filled / 3-quarter / half /
 *     dotted) signal bucket inline — no redundant bucket pills.
 *   - Hairline dividers on every row, no rounded panel borders.
 *   - 28px row height with mono numerals and ink-dim metadata.
 *   - Soft hover wash slot ready (left static for the marketing surface).
 *
 * Single file, only `framer` + `framer-motion`. No `lucide-react`.
 *
 * Design notes (Emil + Linear):
 *   - Mono font + tabular-nums on every count and timestamp.
 *   - Hairline dividers via `box-shadow: inset 0 -1px 0`.
 *   - One-time mount stagger (ease-out cubic, 280–340ms); after that
 *     the composition is static apart from a single ember pulse on
 *     the focal workflow dot (CSS keyframes, off main thread).
 *   - `useReducedMotion` parks the entrance and disables the pulse.
 */

import { useMemo } from "react"
import type { CSSProperties, ReactNode } from "react"
import { addPropertyControls, ControlType } from "framer"
import { motion, useReducedMotion } from "framer-motion"

/* ─── Constants ─────────────────────────────────────────────── */

const HEADER_HEIGHT = 32
const PATH_HEIGHT = 24
const FILTER_HEIGHT = 28
const GROUP_HEADER_HEIGHT = 24
const ROW_HEIGHT = 28
const GROUP_GAP = 6

/* ─── Sample data ───────────────────────────────────────────── */

interface WorkflowNode {
    id: string
    label: string
    focal?: boolean
}

const FOCAL_NODE_ID = "process"

const WORKFLOW_NODES: WorkflowNode[] = [
    { id: "auth",    label: "auth.verify"     },
    { id: "fetch",   label: "fetch.profile"   },
    { id: "process", label: "process.refund", focal: true },
    { id: "notify",  label: "notify.user"     },
    { id: "audit",   label: "audit.log"       },
]

type BucketId = "captured" | "adjacent" | "emerging" | "edge"
type FilterBucket = "all" | BucketId
type SourceId = "intercom" | "stripe" | "shopify" | "slack" | "klarna" | "sift"

interface BucketMeta {
    id: BucketId
    label: string
    description: string
    /** Tone key — mapped to a theme color in the component. */
    tone: "ember" | "violet" | "amber" | "dim"
    /** Visual progress glyph variant. */
    glyph: "filled" | "three-quarter" | "half" | "dotted"
}

const BUCKET_META: Record<BucketId, BucketMeta> = {
    captured: {
        id: "captured",
        label: "Captured",
        description: "from real traces",
        tone: "ember",
        glyph: "filled",
    },
    adjacent: {
        id: "adjacent",
        label: "Adjacent",
        description: "variations",
        tone: "violet",
        glyph: "three-quarter",
    },
    emerging: {
        id: "emerging",
        label: "Emerging",
        description: "new patterns",
        tone: "amber",
        glyph: "half",
    },
    edge: {
        id: "edge",
        label: "Edge",
        description: "unusual",
        tone: "dim",
        glyph: "dotted",
    },
}

const BUCKET_ORDER: BucketId[] = ["captured", "adjacent", "emerging", "edge"]

const SOURCE_LABEL: Record<SourceId, string> = {
    intercom: "I",
    stripe:   "S",
    shopify:  "Sh",
    slack:    "Sl",
    klarna:   "K",
    sift:     "Sf",
}

interface Scenario {
    id: string
    bucket: BucketId
    traceKey: string
    label: string
    sources: SourceId[]
    traceCount: number
    lastSeen: string
}

const SCENARIOS: Scenario[] = [
    { id: "s1", bucket: "captured", traceKey: "tr_a82c", label: "refund.standard",            sources: ["stripe", "intercom"],     traceCount: 234, lastSeen: "4m"  },
    { id: "s2", bucket: "captured", traceKey: "tr_b73x", label: "refund.late_request",        sources: ["stripe"],                 traceCount: 89,  lastSeen: "12m" },
    { id: "s3", bucket: "captured", traceKey: "tr_c91k", label: "refund.partial",             sources: ["stripe", "shopify"],      traceCount: 156, lastSeen: "1h"  },
    { id: "s4", bucket: "adjacent", traceKey: "tr_d44e", label: "refund.with_promo",          sources: ["stripe", "slack"],        traceCount: 45,  lastSeen: "2h"  },
    { id: "s5", bucket: "adjacent", traceKey: "tr_d51f", label: "refund.duplicate_charge",    sources: ["stripe"],                 traceCount: 23,  lastSeen: "3h"  },
    { id: "s6", bucket: "emerging", traceKey: "tr_e22n", label: "refund.subscription_paused", sources: ["stripe"],                 traceCount: 12,  lastSeen: "4h"  },
    { id: "s7", bucket: "emerging", traceKey: "tr_e28p", label: "refund.bnpl_partial",        sources: ["stripe", "klarna"],       traceCount: 7,   lastSeen: "5h"  },
    { id: "s8", bucket: "edge",     traceKey: "tr_f88r", label: "refund.race_condition",      sources: ["stripe", "slack"],        traceCount: 3,   lastSeen: "6h"  },
    { id: "s9", bucket: "edge",     traceKey: "tr_f93s", label: "refund.fraud_flagged",       sources: ["stripe", "sift"],         traceCount: 2,   lastSeen: "8h"  },
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

const SparklesIcon = (p: IconProps) => (
    <Icon {...p}>
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
    </Icon>
)
const ChevronRightIcon = (p: IconProps) => (
    <Icon {...p}>
        <polyline points="9 18 15 12 9 6" />
    </Icon>
)
const ChevronDownIcon = (p: IconProps) => (
    <Icon {...p}>
        <polyline points="6 9 12 15 18 9" />
    </Icon>
)
const PlusIcon = (p: IconProps) => (
    <Icon {...p}>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </Icon>
)
const SlidersIcon = (p: IconProps) => (
    <Icon {...p}>
        <line x1="4" y1="21" x2="4" y2="14" />
        <line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" />
        <line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="17" y1="16" x2="23" y2="16" />
    </Icon>
)

/* ─── Status circle (Linear-style progress glyph) ───────────── */

function StatusCircle({
    glyph, color,
}: {
    glyph: BucketMeta["glyph"]
    color: string
}) {
    return (
        <svg
            width={12}
            height={12}
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
                        cx={6}
                        cy={6}
                        r={4}
                        fill="none"
                        stroke={color}
                        strokeWidth={1.2}
                    />
                    {/* Pie slice covering 3/4 of the circle, starting from
                        the top (12 o'clock) and sweeping clockwise to 9 o'clock. */}
                    <path
                        d="M 6 2 A 4 4 0 1 1 2 6 L 6 6 Z"
                        fill={color}
                    />
                </>
            ) : null}
            {glyph === "half" ? (
                <>
                    <circle
                        cx={6}
                        cy={6}
                        r={4}
                        fill="none"
                        stroke={color}
                        strokeWidth={1.2}
                    />
                    {/* Right half pie from 12 o'clock clockwise to 6 o'clock. */}
                    <path
                        d="M 6 2 A 4 4 0 0 1 6 10 L 6 6 Z"
                        fill={color}
                    />
                </>
            ) : null}
            {glyph === "dotted" ? (
                <circle
                    cx={6}
                    cy={6}
                    r={4}
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
    eventPink: string
}

interface Props extends Theme {
    intercomColor: string
    stripeColor: string
    shopifyColor: string
    slackColor: string
    klarnaColor: string
    siftColor: string
    focalLabel: string
    capturedCount: number
    adjacentCount: number
    emergingCount: number
    edgeCount: number
    filterBucket: FilterBucket
}

/* ─── Top-level component ───────────────────────────────────── */

export default function MiniScenarioDiscovery(props: Props) {
    const {
        page, surfaceBar, wash,
        hairline, hairlineStrong,
        inkHi, ink, inkLo, inkDim, inkFaint,
        ember, teal, violet, amber, eventGreen, eventPink,
        intercomColor, stripeColor, shopifyColor, slackColor, klarnaColor, siftColor,
        focalLabel,
        capturedCount, adjacentCount, emergingCount, edgeCount,
        filterBucket,
    } = props

    const reducedMotion = useReducedMotion()

    const sourceColorMap: Record<SourceId, string> = {
        intercom: intercomColor,
        stripe:   stripeColor,
        shopify:  shopifyColor,
        slack:    slackColor,
        klarna:   klarnaColor,
        sift:     siftColor,
    }

    const bucketCounts: Record<BucketId, number> = {
        captured: capturedCount,
        adjacent: adjacentCount,
        emerging: emergingCount,
        edge:     edgeCount,
    }
    const totalCount =
        capturedCount + adjacentCount + emergingCount + edgeCount

    const bucketTone: Record<BucketMeta["tone"], string> = {
        ember,
        violet,
        amber,
        dim: inkDim,
    }

    const workflowNodes = useMemo(
        () =>
            WORKFLOW_NODES.map((n) =>
                n.id === FOCAL_NODE_ID ? { ...n, label: focalLabel } : n,
            ),
        [focalLabel],
    )

    const visibleBuckets = useMemo<BucketId[]>(
        () =>
            filterBucket === "all"
                ? BUCKET_ORDER
                : BUCKET_ORDER.filter((b) => b === filterBucket),
        [filterBucket],
    )

    const groupedScenarios = useMemo(() => {
        const map = new Map<BucketId, Scenario[]>()
        for (const b of BUCKET_ORDER) map.set(b, [])
        for (const s of SCENARIOS) map.get(s.bucket)?.push(s)
        return map
    }, [])

    return (
        <div
            role="img"
            aria-label="Chronicle scenario discovery — Linear-density list of test scenarios mined from real traces, grouped by bucket"
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
                @keyframes msd-pulse-soft {
                    0%, 100% { opacity: 1; }
                    50%      { opacity: 0.45; }
                }
                @keyframes msd-pulse-ring {
                    0%   { transform: scale(1);   opacity: 0.55; }
                    100% { transform: scale(2.0); opacity: 0; }
                }
                @media (prefers-reduced-motion: reduce) {
                    .msd-pulse-soft,
                    .msd-pulse-ring {
                        animation: none !important;
                        opacity: 1 !important;
                        transform: none !important;
                    }
                }
            `}</style>

            <Header
                surfaceBar={surfaceBar}
                hairline={hairline}
                inkHi={inkHi}
                inkDim={inkDim}
                ember={ember}
                eventGreen={eventGreen}
                total={totalCount}
                animate={!reducedMotion}
            />

            <WorkflowPath
                nodes={workflowNodes}
                hairline={hairline}
                inkHi={inkHi}
                inkLo={inkLo}
                inkDim={inkDim}
                inkFaint={inkFaint}
                ember={ember}
                animate={!reducedMotion}
            />

            <FilterBar
                hairline={hairline}
                hairlineStrong={hairlineStrong}
                inkHi={inkHi}
                inkLo={inkLo}
                inkDim={inkDim}
                inkFaint={inkFaint}
                ember={ember}
                totalCount={totalCount}
                animate={!reducedMotion}
            />

            <ScenarioList
                visibleBuckets={visibleBuckets}
                groupedScenarios={groupedScenarios}
                bucketCounts={bucketCounts}
                bucketTone={bucketTone}
                sourceColorMap={sourceColorMap}
                wash={wash}
                hairline={hairline}
                hairlineStrong={hairlineStrong}
                inkHi={inkHi}
                inkLo={inkLo}
                inkDim={inkDim}
                inkFaint={inkFaint}
                page={page}
                ember={ember}
                animate={!reducedMotion}
            />
        </div>
    )
}

/* ─── Header ────────────────────────────────────────────────── */

function Header({
    surfaceBar, hairline, inkHi, inkDim, ember, eventGreen, total, animate,
}: {
    surfaceBar: string
    hairline: string
    inkHi: string
    inkDim: string
    ember: string
    eventGreen: string
    total: number
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
                <SparklesIcon size={12} strokeWidth={1.75} />
            </span>
            <span style={{ fontWeight: 620 }}>Scenario Discovery</span>

            <span
                style={{
                    marginLeft: "auto",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                }}
            >
                <span style={{ position: "relative", width: 6, height: 6 }}>
                    <span
                        className="msd-pulse-ring"
                        aria-hidden
                        style={{
                            position: "absolute",
                            inset: 0,
                            borderRadius: 999,
                            background: eventGreen,
                            animation: animate
                                ? "msd-pulse-ring 1.8s ease-out infinite"
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
                <span style={{ color: inkDim }}>
                    <span style={{ color: inkHi, fontWeight: 620 }}>{total}</span>
                    {" "}live
                </span>
            </span>
        </div>
    )
}

/* ─── Workflow path strip (inline text breadcrumb) ─────────── */

function WorkflowPath({
    nodes, hairline, inkHi, inkLo, inkDim, inkFaint, ember, animate,
}: {
    nodes: WorkflowNode[]
    hairline: string
    inkHi: string
    inkLo: string
    inkDim: string
    inkFaint: string
    ember: string
    animate: boolean
}) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                height: PATH_HEIGHT,
                flexShrink: 0,
                padding: "0 12px",
                boxShadow: `inset 0 -1px 0 ${hairline}`,
                fontFamily:
                    '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 10.5,
                lineHeight: 1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                minWidth: 0,
            }}
        >
            <span
                aria-hidden
                style={{
                    color: inkDim,
                    fontSize: 9,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    fontWeight: 620,
                }}
            >
                Path
            </span>
            <span
                aria-hidden
                style={{
                    width: 1,
                    height: 10,
                    background: hairline,
                    margin: "0 4px 0 2px",
                    flexShrink: 0,
                }}
            />
            {nodes.map((node, i) => (
                <span
                    key={node.id}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        flexShrink: 0,
                    }}
                >
                    <motion.span
                        initial={animate ? { opacity: 0 } : false}
                        animate={{ opacity: 1 }}
                        transition={
                            animate
                                ? { duration: 0.3, delay: 0.05 + i * 0.04, ease: [0.215, 0.61, 0.355, 1] }
                                : { duration: 0 }
                        }
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            color: node.focal ? inkHi : inkLo,
                            fontWeight: node.focal ? 620 : 500,
                        }}
                    >
                        {node.focal ? (
                            <span
                                aria-hidden
                                className={animate ? "msd-pulse-soft" : undefined}
                                style={{
                                    width: 5,
                                    height: 5,
                                    borderRadius: 999,
                                    background: ember,
                                    boxShadow: `0 0 5px ${ember}aa`,
                                    animation: animate
                                        ? "msd-pulse-soft 2s ease-in-out infinite"
                                        : undefined,
                                }}
                            />
                        ) : null}
                        {node.label}
                    </motion.span>
                    {i < nodes.length - 1 ? (
                        <span
                            aria-hidden
                            style={{
                                color: inkFaint,
                                display: "inline-flex",
                            }}
                        >
                            <ChevronRightIcon size={9} strokeWidth={1.5} />
                        </span>
                    ) : null}
                </span>
            ))}
        </div>
    )
}

/* ─── Filter bar (Linear-style inline filters) ──────────────── */

function FilterBar({
    hairline, hairlineStrong,
    inkHi, inkLo, inkDim, inkFaint, ember,
    totalCount, animate,
}: {
    hairline: string
    hairlineStrong: string
    inkHi: string
    inkLo: string
    inkDim: string
    inkFaint: string
    ember: string
    totalCount: number
    animate: boolean
}) {
    return (
        <motion.div
            initial={animate ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            transition={
                animate
                    ? { duration: 0.3, delay: 0.18, ease: [0.215, 0.61, 0.355, 1] }
                    : { duration: 0 }
            }
            style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                height: FILTER_HEIGHT,
                flexShrink: 0,
                padding: "0 8px",
                boxShadow: `inset 0 -1px 0 ${hairline}`,
            }}
        >
            <FilterPill label="Status" value="All" inkLo={inkLo} inkDim={inkDim} inkFaint={inkFaint} />
            <FilterPill label="Source" value="All" inkLo={inkLo} inkDim={inkDim} inkFaint={inkFaint} />
            <FilterPill label="Sort" value="Last seen" inkLo={inkLo} inkDim={inkDim} inkFaint={inkFaint} />
            <FilterPlusButton inkDim={inkDim} hairlineStrong={hairlineStrong} />

            <span
                style={{
                    marginLeft: "auto",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    color: inkDim,
                    fontFamily:
                        '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 10,
                }}
            >
                <SlidersIcon size={11} strokeWidth={1.6} />
                <span>
                    <span style={{ color: inkLo, fontWeight: 620 }}>{totalCount}</span>
                    {" "}scenarios
                </span>
            </span>
        </motion.div>
    )
}

function FilterPill({
    label, value, inkLo, inkDim, inkFaint,
}: {
    label: string
    value: string
    inkLo: string
    inkDim: string
    inkFaint: string
}) {
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                height: 20,
                padding: "0 6px",
                borderRadius: 4,
                color: inkLo,
                fontFamily:
                    '"Inter", "Inter Variable", ui-sans-serif, system-ui, sans-serif',
                fontSize: 11,
                fontWeight: 510,
                lineHeight: 1,
                whiteSpace: "nowrap",
                cursor: "default",
            }}
        >
            <span style={{ color: inkDim, fontWeight: 500 }}>{label}</span>
            <span style={{ color: inkFaint }}>·</span>
            <span style={{ color: inkLo }}>{value}</span>
            <span aria-hidden style={{ color: inkFaint, display: "inline-flex" }}>
                <ChevronDownIcon size={9} strokeWidth={1.6} />
            </span>
        </span>
    )
}

function FilterPlusButton({
    inkDim, hairlineStrong,
}: {
    inkDim: string
    hairlineStrong: string
}) {
    return (
        <span
            aria-label="Add filter"
            style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 20,
                height: 20,
                marginLeft: 2,
                borderRadius: 4,
                color: inkDim,
                boxShadow: `inset 0 0 0 1px ${hairlineStrong}`,
                cursor: "default",
            }}
        >
            <PlusIcon size={10} strokeWidth={1.75} />
        </span>
    )
}

/* ─── Scenario list ─────────────────────────────────────────── */

function ScenarioList({
    visibleBuckets, groupedScenarios, bucketCounts, bucketTone, sourceColorMap,
    wash, hairline, hairlineStrong,
    inkHi, inkLo, inkDim, inkFaint,
    page, ember, animate,
}: {
    visibleBuckets: BucketId[]
    groupedScenarios: Map<BucketId, Scenario[]>
    bucketCounts: Record<BucketId, number>
    bucketTone: Record<BucketMeta["tone"], string>
    sourceColorMap: Record<SourceId, string>
    wash: string
    hairline: string
    hairlineStrong: string
    inkHi: string
    inkLo: string
    inkDim: string
    inkFaint: string
    page: string
    ember: string
    animate: boolean
}) {
    /* Flat row index used for staggered entrance — counts both group
       headers and rows so the cascade reads top-to-bottom. */
    let entranceIndex = 0
    const startDelay = 0.28

    return (
        <div
            style={{
                position: "relative",
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    overflowY: "auto",
                }}
            >
                {visibleBuckets.map((bucketId, gi) => {
                    const bucket = BUCKET_META[bucketId]
                    const tone = bucketTone[bucket.tone]
                    const items = groupedScenarios.get(bucketId) ?? []
                    const groupHeaderIndex = entranceIndex++

                    return (
                        <div
                            key={bucketId}
                            style={{
                                marginTop: gi === 0 ? 0 : GROUP_GAP,
                            }}
                        >
                            <GroupHeader
                                bucket={bucket}
                                count={bucketCounts[bucketId]}
                                tone={tone}
                                inkHi={inkHi}
                                inkDim={inkDim}
                                inkFaint={inkFaint}
                                hairline={hairline}
                                hairlineStrong={hairlineStrong}
                                animate={animate}
                                delay={startDelay + groupHeaderIndex * 0.025}
                            />

                            {items.map((scenario) => {
                                const rowIndex = entranceIndex++
                                return (
                                    <ScenarioRow
                                        key={scenario.id}
                                        scenario={scenario}
                                        glyph={bucket.glyph}
                                        glyphColor={tone}
                                        sourceColorMap={sourceColorMap}
                                        wash={wash}
                                        hairline={hairline}
                                        inkHi={inkHi}
                                        inkLo={inkLo}
                                        inkDim={inkDim}
                                        inkFaint={inkFaint}
                                        page={page}
                                        animate={animate}
                                        delay={startDelay + rowIndex * 0.025}
                                    />
                                )
                            })}
                        </div>
                    )
                })}
                {/* Bottom soft fade hinting more content below */}
                <span
                    aria-hidden
                    style={{
                        position: "sticky",
                        bottom: 0,
                        display: "block",
                        height: 22,
                        marginTop: -22,
                        background: `linear-gradient(to top, ${page} 0%, transparent 100%)`,
                        pointerEvents: "none",
                    }}
                />
            </div>
        </div>
    )
}

/* ─── Group header (Linear collapsible style) ──────────────── */

function GroupHeader({
    bucket, count, tone,
    inkHi, inkDim, inkFaint,
    hairline, hairlineStrong,
    animate, delay,
}: {
    bucket: BucketMeta
    count: number
    tone: string
    inkHi: string
    inkDim: string
    inkFaint: string
    hairline: string
    hairlineStrong: string
    animate: boolean
    delay: number
}) {
    return (
        <motion.div
            initial={animate ? { opacity: 0, y: 2 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={
                animate
                    ? { duration: 0.28, delay, ease: [0.215, 0.61, 0.355, 1] }
                    : { duration: 0 }
            }
            style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                height: GROUP_HEADER_HEIGHT,
                padding: "0 12px",
                background: `${tone}0d`,
                boxShadow: `inset 0 -1px 0 ${hairline}, inset 2px 0 0 ${tone}66`,
            }}
        >
            <span
                aria-hidden
                style={{
                    color: inkDim,
                    display: "inline-flex",
                    flexShrink: 0,
                }}
            >
                <ChevronDownIcon size={10} strokeWidth={1.6} />
            </span>
            <span
                style={{
                    fontFamily:
                        '"Inter", "Inter Variable", ui-sans-serif, system-ui, sans-serif',
                    fontSize: 11,
                    fontWeight: 620,
                    color: inkHi,
                    lineHeight: 1,
                }}
            >
                {bucket.label}
            </span>
            <span
                style={{
                    fontFamily:
                        '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 10,
                    color: inkDim,
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1,
                }}
            >
                {count}
            </span>
            <span
                style={{
                    marginLeft: "auto",
                    fontFamily:
                        '"Inter", "Inter Variable", ui-sans-serif, system-ui, sans-serif',
                    fontSize: 10.5,
                    color: inkFaint,
                    lineHeight: 1,
                }}
            >
                {bucket.description}
            </span>
        </motion.div>
    )
}

/* ─── Scenario row (28px Linear-density) ───────────────────── */

function ScenarioRow({
    scenario, glyph, glyphColor, sourceColorMap,
    wash, hairline,
    inkHi, inkLo, inkDim, inkFaint,
    page, animate, delay,
}: {
    scenario: Scenario
    glyph: BucketMeta["glyph"]
    glyphColor: string
    sourceColorMap: Record<SourceId, string>
    wash: string
    hairline: string
    inkHi: string
    inkLo: string
    inkDim: string
    inkFaint: string
    page: string
    animate: boolean
    delay: number
}) {
    return (
        <motion.div
            initial={animate ? { opacity: 0, y: 2 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={
                animate
                    ? { duration: 0.26, delay, ease: [0.215, 0.61, 0.355, 1] }
                    : { duration: 0 }
            }
            style={{
                display: "grid",
                gridTemplateColumns: "12px auto minmax(0, 1fr) auto auto auto",
                alignItems: "center",
                gap: 10,
                height: ROW_HEIGHT,
                padding: "0 12px",
                boxShadow: `inset 0 -1px 0 ${hairline}`,
            }}
        >
            <StatusCircle glyph={glyph} color={glyphColor} />

            <span
                style={{
                    fontFamily:
                        '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 10,
                    color: inkDim,
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                }}
            >
                {scenario.traceKey}
            </span>

            <span
                style={{
                    fontFamily:
                        '"Inter", "Inter Variable", ui-sans-serif, system-ui, sans-serif',
                    fontSize: 12,
                    fontWeight: 510,
                    color: inkHi,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                }}
                title={scenario.label}
            >
                {scenario.label}
            </span>

            <SourceStack
                sources={scenario.sources}
                sourceColorMap={sourceColorMap}
                page={page}
                inkFaint={inkFaint}
            />

            <span
                style={{
                    display: "inline-flex",
                    alignItems: "baseline",
                    gap: 4,
                    minWidth: 0,
                    flexShrink: 0,
                }}
            >
                <span
                    style={{
                        fontFamily:
                            '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 10.5,
                        color: inkLo,
                        fontVariantNumeric: "tabular-nums",
                        textAlign: "right",
                        minWidth: 28,
                    }}
                >
                    {formatNumber(scenario.traceCount)}
                </span>
                <span
                    style={{
                        fontFamily:
                            '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 9.5,
                        color: inkDim,
                        fontVariantNumeric: "tabular-nums",
                        whiteSpace: "nowrap",
                        textAlign: "right",
                        minWidth: 22,
                    }}
                >
                    · {scenario.lastSeen}
                </span>
            </span>

            <span
                aria-hidden
                style={{
                    color: inkFaint,
                    display: "inline-flex",
                }}
            >
                <ChevronRightIcon size={11} strokeWidth={1.5} />
            </span>
        </motion.div>
    )
}

function SourceStack({
    sources, sourceColorMap, page, inkFaint,
}: {
    sources: SourceId[]
    sourceColorMap: Record<SourceId, string>
    page: string
    inkFaint: string
}) {
    const max = 3
    const visible = sources.slice(0, max)
    const overflow = sources.length - visible.length

    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                flexShrink: 0,
            }}
        >
            {visible.map((src, i) => {
                const color = sourceColorMap[src] ?? inkFaint
                return (
                    <span
                        key={src}
                        aria-hidden
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 14, height: 14,
                            borderRadius: 3,
                            background: `${color}26`,
                            color: color,
                            boxShadow: `0 0 0 1px ${page}, inset 0 0 0 1px ${color}66`,
                            fontFamily:
                                '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                            fontSize: 8,
                            fontWeight: 700,
                            marginLeft: i === 0 ? 0 : -3,
                            zIndex: visible.length - i,
                            position: "relative",
                        }}
                        title={src}
                    >
                        {SOURCE_LABEL[src]}
                    </span>
                )
            })}
            {overflow > 0 ? (
                <span
                    style={{
                        marginLeft: 3,
                        fontFamily:
                            '"Berkeley Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 9,
                        color: inkFaint,
                    }}
                >
                    +{overflow}
                </span>
            ) : null}
        </span>
    )
}

/* ─── Helpers ───────────────────────────────────────────────── */

function formatNumber(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return String(n)
}

/* ─── Defaults + Framer property controls ───────────────────── */

MiniScenarioDiscovery.defaultProps = {
    page:           "#0c0d10",
    surfaceBar:     "#131418",
    wash:           "rgba(255, 255, 255, 0.014)",
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
    eventPink:      "#f472b6",
    intercomColor:  "#2dd4bf",
    stripeColor:    "#4ade80",
    shopifyColor:   "#fbbf24",
    slackColor:     "#f472b6",
    klarnaColor:    "#ffb3c1",
    siftColor:      "#8b5cf6",
    focalLabel:     "process.refund",
    capturedCount:  12,
    adjacentCount:  34,
    emergingCount:  8,
    edgeCount:      4,
    filterBucket:   "all",
}

addPropertyControls(MiniScenarioDiscovery, {
    filterBucket: {
        type: ControlType.Enum,
        title: "Filter",
        options: ["all", "captured", "adjacent", "emerging", "edge"],
        optionTitles: ["All", "Captured", "Adjacent", "Emerging", "Edge"],
        defaultValue: "all",
    },
    focalLabel: {
        type: ControlType.String,
        title: "Focal Step",
        defaultValue: "process.refund",
    },
    capturedCount: {
        type: ControlType.Number,
        title: "Captured",
        defaultValue: 12,
        min: 0, max: 9999, step: 1,
    },
    adjacentCount: {
        type: ControlType.Number,
        title: "Adjacent",
        defaultValue: 34,
        min: 0, max: 9999, step: 1,
    },
    emergingCount: {
        type: ControlType.Number,
        title: "Emerging",
        defaultValue: 8,
        min: 0, max: 9999, step: 1,
    },
    edgeCount: {
        type: ControlType.Number,
        title: "Edge",
        defaultValue: 4,
        min: 0, max: 9999, step: 1,
    },
    page:           { type: ControlType.Color, title: "Page",            defaultValue: "#0c0d10" },
    surfaceBar:     { type: ControlType.Color, title: "Surface Bar",     defaultValue: "#131418" },
    wash:           { type: ControlType.Color, title: "Row Wash",        defaultValue: "rgba(255, 255, 255, 0.014)" },
    hairline:       { type: ControlType.Color, title: "Hairline",        defaultValue: "rgba(255, 255, 255, 0.08)" },
    hairlineStrong: { type: ControlType.Color, title: "Hairline Strong", defaultValue: "rgba(255, 255, 255, 0.14)" },
    inkHi:          { type: ControlType.Color, title: "Ink Hi",          defaultValue: "#f7f8f8" },
    ink:            { type: ControlType.Color, title: "Ink",             defaultValue: "#d0d6e0" },
    inkLo:          { type: ControlType.Color, title: "Ink Lo",          defaultValue: "#8a8f98" },
    inkDim:         { type: ControlType.Color, title: "Ink Dim",         defaultValue: "#62666d" },
    inkFaint:       { type: ControlType.Color, title: "Ink Faint",       defaultValue: "rgba(247, 248, 248, 0.40)" },
    ember:          { type: ControlType.Color, title: "Ember (Captured)", defaultValue: "#d8430a" },
    teal:           { type: ControlType.Color, title: "Teal",             defaultValue: "#2dd4bf" },
    violet:         { type: ControlType.Color, title: "Violet (Adjacent)", defaultValue: "#8b5cf6" },
    amber:          { type: ControlType.Color, title: "Amber (Emerging)", defaultValue: "#fbbf24" },
    eventGreen:     { type: ControlType.Color, title: "Live Dot",        defaultValue: "#4ade80" },
    eventPink:      { type: ControlType.Color, title: "Pink",            defaultValue: "#f472b6" },
    intercomColor:  { type: ControlType.Color, title: "Intercom",        defaultValue: "#2dd4bf" },
    stripeColor:    { type: ControlType.Color, title: "Stripe",          defaultValue: "#4ade80" },
    shopifyColor:   { type: ControlType.Color, title: "Shopify",         defaultValue: "#fbbf24" },
    slackColor:     { type: ControlType.Color, title: "Slack",           defaultValue: "#f472b6" },
    klarnaColor:    { type: ControlType.Color, title: "Klarna",          defaultValue: "#ffb3c1" },
    siftColor:      { type: ControlType.Color, title: "Sift",            defaultValue: "#8b5cf6" },
})

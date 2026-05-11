"use client";

import * as React from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";

import { CompanyLogo } from "../icons";
import { Logo } from "../primitives/logo";
import {
  sourceColor,
  sourceTintedBackground,
} from "../stream-timeline/source-color";
import { cn } from "../utils/cn";
import { useReducedMotion } from "../utils/use-reduced-motion";

type LoopStage =
  | "production"
  | "stream"
  | "selected"
  | "converge"
  | "mirror"
  | "ready";

type LoopPhase = "production" | "trace" | "replay" | "static";
type SourceId = "intercom" | "stripe" | "shopify";

type ProductionSource = {
  id: SourceId;
  name: string;
  domain: string;
  timestamp: string;
  selectedAt: number;
  blocks: Array<{
    id: string;
    left: number;
    width: number;
    tone: "dim" | "hot";
  }>;
};

type ReplayStep = {
  source: SourceId;
  sequence: string;
  timestamp: string;
  event: string;
  label: string;
};

const TRACE_ID = "trace_9F3A";

const LOOP_STAGES: LoopStage[] = [
  "production",
  "stream",
  "selected",
  "converge",
  "mirror",
  "ready",
];

const STAGE_DURATIONS: Record<LoopStage, number> = {
  production: 950,
  stream: 1850,
  selected: 1250,
  converge: 900,
  mirror: 1600,
  ready: 2300,
};

const SURFACE_TRANSITION = {
  type: "spring",
  duration: 0.62,
  bounce: 0.08,
} as const;

const CONTENT_TRANSITION = {
  type: "spring",
  duration: 0.38,
  bounce: 0.06,
} as const;

const PRODUCTION_SOURCES: ProductionSource[] = [
  {
    id: "intercom",
    name: "Intercom",
    domain: "intercom.com",
    timestamp: "14:02:11.084",
    selectedAt: 47,
    blocks: [
      { id: "ic-001", left: 12, width: 10, tone: "dim" },
      { id: "ic-002", left: 31, width: 12, tone: "dim" },
      { id: "ic-003", left: 47, width: 18, tone: "hot" },
      { id: "ic-004", left: 82, width: 10, tone: "dim" },
    ],
  },
  {
    id: "stripe",
    name: "Stripe",
    domain: "stripe.com",
    timestamp: "14:02:12.410",
    selectedAt: 58,
    blocks: [
      { id: "st-001", left: 18, width: 9, tone: "dim" },
      { id: "st-002", left: 39, width: 13, tone: "dim" },
      { id: "st-003", left: 58, width: 20, tone: "hot" },
      { id: "st-004", left: 85, width: 10, tone: "dim" },
    ],
  },
  {
    id: "shopify",
    name: "Shopify",
    domain: "shopify.com",
    timestamp: "14:02:13.026",
    selectedAt: 72,
    blocks: [
      { id: "sh-001", left: 15, width: 11, tone: "dim" },
      { id: "sh-002", left: 41, width: 9, tone: "dim" },
      { id: "sh-003", left: 72, width: 18, tone: "hot" },
      { id: "sh-004", left: 89, width: 8, tone: "dim" },
    ],
  },
];

const REPLAY_STEPS: ReplayStep[] = [
  {
    source: "intercom",
    sequence: "seq.001",
    timestamp: "14:02:11.084",
    event: "message.created",
    label: "Intercom",
  },
  {
    source: "stripe",
    sequence: "seq.002",
    timestamp: "14:02:12.410",
    event: "invoice.payment_succeeded",
    label: "Stripe",
  },
  {
    source: "shopify",
    sequence: "seq.003",
    timestamp: "14:02:13.026",
    event: "order.created",
    label: "Shopify",
  },
];

export interface ProductionCaptureAnimationProps extends React.HTMLAttributes<HTMLDivElement> {
  ariaLabel?: string;
}

export function ProductionCaptureAnimation({
  ariaLabel = "Chronicle core loop animation showing Intercom, Stripe, and Shopify production streams captured as trace_9F3A, mirrored into a replay environment, and marked replay ready for AI agent testing.",
  className,
  ...props
}: ProductionCaptureAnimationProps) {
  const reducedMotion = useReducedMotion();
  const animatedStage = useCoreLoopStage(reducedMotion);
  const stage = reducedMotion ? "ready" : animatedStage;
  const phase = getLoopPhase(stage, reducedMotion);

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={cn(
        "relative aspect-square w-full overflow-hidden rounded-md border border-hairline bg-surface-01 shadow-card",
        className
      )}
      {...props}
    >
      <CoreLoopStyles />

      <div className="cl-card" aria-hidden data-stage={stage}>
        <CardHeader />

        <LayoutGroup id="chronicle-core-loop">
          <motion.section
            layout
            className="cl-shared-surface"
            initial={false}
            animate={surfaceMotion(stage, reducedMotion)}
            transition={reducedMotion ? { duration: 0 } : SURFACE_TRANSITION}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {phase === "production" ? (
                <MotionContent key="production">
                  <ProductionPanel
                    stage={stage}
                    reducedMotion={reducedMotion}
                  />
                </MotionContent>
              ) : null}

              {phase === "trace" ? (
                <MotionContent key="trace">
                  <SelectedTracePanel stage={stage} />
                </MotionContent>
              ) : null}

              {phase === "replay" ? (
                <MotionContent key="replay">
                  <ReplayPanel stage={stage} reducedMotion={reducedMotion} />
                </MotionContent>
              ) : null}

              {phase === "static" ? (
                <MotionContent key="static" reducedMotion>
                  <ReducedMotionPanel />
                </MotionContent>
              ) : null}
            </AnimatePresence>
          </motion.section>
        </LayoutGroup>
      </div>
    </div>
  );
}

function useCoreLoopStage(reducedMotion: boolean) {
  const [stage, setStage] = React.useState<LoopStage>("production");

  React.useEffect(() => {
    if (reducedMotion) {
      setStage("ready");
      return;
    }

    let stageIndex = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const runStage = () => {
      const nextStage = LOOP_STAGES[stageIndex];
      setStage(nextStage);
      timeout = setTimeout(() => {
        stageIndex = (stageIndex + 1) % LOOP_STAGES.length;
        runStage();
      }, STAGE_DURATIONS[nextStage]);
    };

    runStage();

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [reducedMotion]);

  return stage;
}

function getLoopPhase(stage: LoopStage, reducedMotion: boolean): LoopPhase {
  if (reducedMotion) return "static";
  if (stage === "production" || stage === "stream") return "production";
  if (stage === "selected" || stage === "converge") return "trace";
  return "replay";
}

function CardHeader() {
  return (
    <div className="cl-header">
      <div className="cl-brand">
        <Logo variant="icon" theme="dark" className="cl-brand-mark" />
        <span>Chronicle</span>
      </div>
      <span className="cl-core-label">CORE LOOP</span>
      <span className="cl-live-pill">
        <span className="cl-live-dot" />
        LIVE
      </span>
    </div>
  );
}

function MotionContent({
  children,
  reducedMotion = false,
}: {
  children: React.ReactNode;
  reducedMotion?: boolean;
}) {
  return (
    <motion.div
      className="cl-surface-content"
      initial={
        reducedMotion
          ? false
          : { opacity: 0, scale: 0.975, filter: "blur(7px)" }
      }
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={
        reducedMotion
          ? undefined
          : { opacity: 0, scale: 0.97, filter: "blur(7px)" }
      }
      transition={reducedMotion ? { duration: 0 } : CONTENT_TRANSITION}
    >
      {children}
    </motion.div>
  );
}

function ProductionPanel({
  stage,
  reducedMotion,
}: {
  stage: LoopStage;
  reducedMotion: boolean;
}) {
  return (
    <div className="cl-production-panel">
      <div className="cl-panel-top">
        <div>
          <span className="cl-section-label">PRODUCTION STREAMS</span>
          <strong>capturing production trace</strong>
        </div>
        <span className="cl-panel-meta">backfill / live</span>
      </div>

      <div className="cl-axis-row">
        <span>source</span>
        <span>event timeline</span>
        <span>status</span>
      </div>

      <div className="cl-streams">
        {PRODUCTION_SOURCES.map((source, index) => (
          <ProductionStreamRow
            key={source.id}
            source={source}
            index={index}
            stage={stage}
            reducedMotion={reducedMotion}
          />
        ))}
      </div>
    </div>
  );
}

function ProductionStreamRow({
  source,
  index,
  stage,
  reducedMotion,
}: {
  source: ProductionSource;
  index: number;
  stage: LoopStage;
  reducedMotion: boolean;
}) {
  const color = sourceColor(source.id);
  const streaming = stage === "stream";

  return (
    <motion.div
      layout
      className="cl-stream-row"
      style={{ "--source-color": color } as React.CSSProperties}
      initial={false}
      animate={{
        opacity: 1,
        y: stage === "production" ? 5 : 0,
      }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : { ...CONTENT_TRANSITION, delay: index * 0.06 }
      }
    >
      <div className="cl-source-cell">
        <CompanyLogo
          name={source.name}
          domain={source.domain}
          size={18}
          radius={4}
          fallbackBackground={sourceTintedBackground(color, 22)}
          fallbackColor="var(--c-ink-hi)"
          className="cl-company-logo"
          aria-hidden
        />
        <span className="cl-source-name">{source.name}</span>
      </div>

      <div className="cl-timeline-cell">
        <div className="cl-track-labels">
          <span>backfill</span>
          <span>live</span>
        </div>
        <div className="cl-track">
          <span className="cl-track-line" />
          {source.blocks.map((block) => {
            const hot = block.tone === "hot";
            return (
              <motion.span
                key={block.id}
                layoutId={hot ? traceBlockLayoutId(source.id) : undefined}
                className={cn(
                  "cl-event-block",
                  hot ? "cl-event-block-hot" : null
                )}
                style={{
                  left: `${block.left}%`,
                  width: `${block.width}px`,
                }}
                initial={false}
                animate={{ opacity: hot ? 0.95 : 0.38, scale: hot ? 1.05 : 1 }}
                transition={
                  reducedMotion ? { duration: 0 } : CONTENT_TRANSITION
                }
              />
            );
          })}

          <AnimatePresence>
            {streaming && !reducedMotion
              ? [0, 1, 2].map((packet) => (
                  <motion.span
                    key={`${source.id}-${packet}`}
                    className="cl-flow-block"
                    initial={{ x: 12, opacity: 0, filter: "blur(3px)" }}
                    animate={{
                      x: [12, 72, 150, 226],
                      opacity: [0, 1, 1, 0],
                      filter: [
                        "blur(3px)",
                        "blur(0px)",
                        "blur(0px)",
                        "blur(2px)",
                      ],
                    }}
                    exit={{ opacity: 0, filter: "blur(3px)" }}
                    transition={{
                      duration: 1.2,
                      delay: index * 0.16 + packet * 0.3,
                      ease: [0.65, 0, 0.35, 1],
                    }}
                  />
                ))
              : null}
          </AnimatePresence>
        </div>
      </div>

      <div className="cl-row-meta">
        <span className="cl-status-dot" />
        <span>{source.timestamp}</span>
      </div>
    </motion.div>
  );
}

function SelectedTracePanel({ stage }: { stage: LoopStage }) {
  const settled = stage === "converge";

  return (
    <div className="cl-selected-panel">
      <div className="cl-selected-header">
        <span>SELECTED TRACE</span>
        <span>production behavior preserved</span>
      </div>

      <motion.div
        layout
        className="cl-trace-hero"
        initial={false}
        animate={{
          scale: settled ? 1 : 0.992,
          filter: settled ? "blur(0px)" : "blur(0.5px)",
        }}
        transition={CONTENT_TRANSITION}
      >
        <div className="cl-trace-copy">
          <span className="cl-trace-kicker">CAPTURED TRACE</span>
          <motion.strong layoutId="trace-id" transition={SURFACE_TRANSITION}>
            {TRACE_ID}
          </motion.strong>
          <span>prod / 14:02:11.084Z / 3 events</span>
        </div>
        <TraceBlockStrip size="hero" />
        <div className="cl-trace-foot">
          <span>source events preserved</span>
          <span>mirror target ready</span>
        </div>
      </motion.div>

      <div className="cl-source-lockup">
        {PRODUCTION_SOURCES.map((source) => (
          <TraceSourceChip key={source.id} source={source} muted={settled} />
        ))}
      </div>
    </div>
  );
}

function TraceSourceChip({
  source,
  muted,
}: {
  source: ProductionSource;
  muted: boolean;
}) {
  const color = sourceColor(source.id);

  return (
    <motion.div
      layout
      className="cl-source-chip"
      style={{ "--source-color": color } as React.CSSProperties}
      initial={false}
      animate={{
        opacity: muted ? 0.6 : 1,
        y: muted ? 4 : 0,
        scale: muted ? 0.985 : 1,
      }}
      transition={CONTENT_TRANSITION}
    >
      <CompanyLogo
        name={source.name}
        domain={source.domain}
        size={17}
        radius={4}
        fallbackBackground={sourceTintedBackground(color, 22)}
        fallbackColor="var(--c-ink-hi)"
        aria-hidden
      />
      <span>{source.name}</span>
      <small>{source.timestamp}</small>
    </motion.div>
  );
}

function ReplayPanel({
  stage,
  reducedMotion,
}: {
  stage: LoopStage;
  reducedMotion: boolean;
}) {
  const ready = stage === "ready" || reducedMotion;

  return (
    <div className="cl-replay-panel">
      <div className="cl-replay-header">
        <div className="cl-replay-title">
          <span>MIRROR / REPLAY ENVIRONMENT</span>
          <motion.strong layoutId="trace-id" transition={SURFACE_TRANSITION}>
            {TRACE_ID}
          </motion.strong>
        </div>
        <div className="cl-replay-meta">
          <TraceBlockStrip size="compact" />
          <span>prod / 14:02:11.084Z</span>
        </div>
      </div>

      <div className="cl-replay-steps">
        {REPLAY_STEPS.map((step, index) => (
          <ReplayEventRow
            key={step.sequence}
            step={step}
            index={index}
            ready={ready}
            reducedMotion={reducedMotion}
          />
        ))}
      </div>

      <motion.div
        className="cl-ready-state"
        initial={false}
        animate={{
          opacity: ready ? 1 : 0.58,
          y: ready ? 0 : 5,
          filter: ready ? "blur(0px)" : "blur(2px)",
        }}
        transition={reducedMotion ? { duration: 0 } : CONTENT_TRANSITION}
      >
        <span className="cl-ready-dot" />
        <span className="cl-ready-copy">
          <strong>{ready ? "REPLAY READY" : "MATCHING"}</strong>
          <span>ALL EVENTS MATCHED</span>
        </span>
        <span className="cl-ready-env">AI AGENT TEST ENV</span>
      </motion.div>
    </div>
  );
}

function ReplayEventRow({
  step,
  index,
  ready,
  reducedMotion,
}: {
  step: ReplayStep;
  index: number;
  ready: boolean;
  reducedMotion: boolean;
}) {
  const color = sourceColor(step.source);

  return (
    <motion.div
      className="cl-replay-row"
      style={{ "--source-color": color } as React.CSSProperties}
      initial={
        reducedMotion
          ? false
          : { opacity: 0, y: 10, scale: 0.975, filter: "blur(5px)" }
      }
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
      }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : { ...CONTENT_TRANSITION, delay: 0.1 + index * 0.18 }
      }
    >
      <span className="cl-replay-index">
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className="cl-replay-marker" />
      <span className="cl-replay-event">{step.event}</span>
      <span className="cl-replay-source">{step.label}</span>
      <span className="cl-replay-time">
        {ready ? step.sequence : step.timestamp}
      </span>
    </motion.div>
  );
}

function ReducedMotionPanel() {
  return (
    <div className="cl-static-panel">
      <div className="cl-static-production">
        <div className="cl-static-label">PRODUCTION STREAMS</div>
        <div className="cl-static-streams">
          {PRODUCTION_SOURCES.map((source) => (
            <StaticSourceRow key={source.id} source={source} />
          ))}
        </div>
      </div>

      <div className="cl-static-trace">
        <div>
          <span>SELECTED TRACE</span>
          <strong>{TRACE_ID}</strong>
        </div>
        <TraceBlockStrip size="compact" />
      </div>

      <div className="cl-static-replay">
        <span>MIRROR / REPLAY ENVIRONMENT</span>
        <strong>REPLAY READY</strong>
        <small>ALL EVENTS MATCHED</small>
      </div>
    </div>
  );
}

function StaticSourceRow({ source }: { source: ProductionSource }) {
  const color = sourceColor(source.id);

  return (
    <div
      className="cl-static-source-row"
      style={{ "--source-color": color } as React.CSSProperties}
    >
      <CompanyLogo
        name={source.name}
        domain={source.domain}
        size={16}
        radius={4}
        fallbackBackground={sourceTintedBackground(color, 22)}
        fallbackColor="var(--c-ink-hi)"
        aria-hidden
      />
      <span>{source.name}</span>
      <span className="cl-static-track">
        <span />
        <span />
        <span />
      </span>
      <small>{source.timestamp}</small>
    </div>
  );
}

function TraceBlockStrip({ size }: { size: "hero" | "compact" }) {
  return (
    <div className={cn("cl-trace-blocks", `cl-trace-blocks-${size}`)}>
      {PRODUCTION_SOURCES.map((source) => (
        <motion.span
          key={source.id}
          layoutId={traceBlockLayoutId(source.id)}
          className="cl-trace-block"
          style={
            { "--source-color": sourceColor(source.id) } as React.CSSProperties
          }
          transition={SURFACE_TRANSITION}
        />
      ))}
    </div>
  );
}

function traceBlockLayoutId(source: SourceId) {
  return `trace-block-${source}`;
}

function surfaceMotion(stage: LoopStage, reducedMotion: boolean) {
  const stableSurface = {
    left: "50%",
    x: "-50%",
    y: "-50%",
    top: "56%",
    width: "88%",
    height: "74%",
    opacity: 1,
    scale: 1,
    borderRadius: 26,
  };

  if (reducedMotion) {
    return {
      ...stableSurface,
      height: "76%",
    };
  }

  if (stage === "selected" || stage === "converge") {
    return {
      ...stableSurface,
      borderRadius: stage === "converge" ? 30 : 28,
    };
  }

  if (stage === "mirror") {
    return {
      ...stableSurface,
      borderRadius: 28,
    };
  }

  return stableSurface;
}

function CoreLoopStyles() {
  return (
    <style>
      {`
        .cl-card,
        .cl-card * {
          box-sizing: border-box;
        }

        .cl-card {
          position: absolute;
          inset: 0;
          isolation: isolate;
          overflow: hidden;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.045), transparent 28%),
            radial-gradient(circle at 50% 8%, rgba(89, 111, 255, 0.13), transparent 30%),
            linear-gradient(180deg, #101116 0%, var(--c-surface-00) 100%);
          color: var(--c-ink);
          font-family: var(--font-sans);
          letter-spacing: 0;
        }

        .cl-card::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.022) 1px, transparent 1px);
          background-size: 34px 34px;
          mask-image: linear-gradient(180deg, transparent 0%, black 18%, black 86%, transparent 100%);
          opacity: 0.48;
        }

        .cl-header {
          position: absolute;
          left: 20px;
          right: 20px;
          top: 17px;
          z-index: 5;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto auto;
          align-items: center;
          gap: 9px;
        }

        .cl-brand,
        .cl-core-label,
        .cl-live-pill,
        .cl-section-label,
        .cl-panel-meta,
        .cl-axis-row,
        .cl-track-labels,
        .cl-row-meta,
        .cl-selected-header,
        .cl-source-chip,
        .cl-trace-copy,
        .cl-replay-title,
        .cl-replay-meta,
        .cl-replay-row,
        .cl-ready-state,
        .cl-static-panel {
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
          letter-spacing: 0;
        }

        .cl-brand {
          display: inline-flex;
          min-width: 0;
          align-items: center;
          gap: 7px;
          color: var(--c-ink-hi);
          font-size: 12px;
          font-weight: 620;
          line-height: 1;
        }

        .cl-brand-mark {
          height: 18px;
          width: 18px;
          flex: 0 0 auto;
        }

        .cl-core-label,
        .cl-live-pill {
          display: inline-flex;
          height: 22px;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--c-hairline);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.028);
          padding: 0 8px;
          color: var(--c-ink-dim);
          font-size: 9px;
          line-height: 1;
          white-space: nowrap;
        }

        .cl-live-pill {
          gap: 6px;
          border-color: rgba(74, 222, 128, 0.22);
          color: var(--c-event-green);
        }

        .cl-live-dot,
        .cl-status-dot,
        .cl-ready-dot {
          display: inline-block;
          border-radius: 999px;
          background: var(--c-event-green);
        }

        .cl-live-dot {
          height: 5px;
          width: 5px;
        }

        .cl-shared-surface {
          position: absolute;
          z-index: 2;
          overflow: hidden;
          border: 1px solid rgba(139, 92, 246, 0.34);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.064), rgba(255, 255, 255, 0.018)),
            color-mix(in srgb, var(--c-surface-01) 90%, black);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.07),
            0 24px 58px rgba(0, 0, 0, 0.42),
            0 0 0 1px rgba(139, 92, 246, 0.055);
          color: var(--c-ink-hi);
          will-change: transform, opacity, border-radius;
        }

        .cl-surface-content {
          position: absolute;
          inset: 0;
          height: 100%;
          width: 100%;
          min-width: 0;
          overflow: hidden;
        }

        .cl-production-panel {
          display: grid;
          height: 100%;
          grid-template-rows: auto auto minmax(0, 1fr);
          gap: 10px;
          padding: 17px 18px 18px;
        }

        .cl-panel-top {
          display: flex;
          align-items: start;
          justify-content: space-between;
          gap: 12px;
        }

        .cl-panel-top > div {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 6px;
        }

        .cl-section-label,
        .cl-panel-meta,
        .cl-axis-row {
          color: var(--c-ink-dim);
          font-size: 9px;
          line-height: 1;
        }

        .cl-panel-top strong {
          color: var(--c-ink-hi);
          font-size: 13px;
          font-weight: 620;
          line-height: 1;
        }

        .cl-panel-meta {
          white-space: nowrap;
        }

        .cl-axis-row {
          display: grid;
          height: 26px;
          grid-template-columns: 112px minmax(0, 1fr) 82px;
          align-items: center;
          border-block: 1px solid var(--c-hairline);
        }

        .cl-axis-row span {
          padding-inline: 8px;
        }

        .cl-axis-row span + span {
          border-left: 1px solid var(--c-hairline);
        }

        .cl-streams {
          display: grid;
          align-content: start;
          gap: 8px;
          min-height: 0;
        }

        .cl-stream-row {
          display: grid;
          height: 48px;
          min-width: 0;
          grid-template-columns: 112px minmax(0, 1fr) 82px;
          align-items: center;
          overflow: hidden;
          border: 1px solid var(--c-hairline);
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.026);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
          will-change: transform, opacity;
        }

        .cl-source-cell {
          display: flex;
          min-width: 0;
          align-items: center;
          gap: 7px;
          height: 100%;
          border-right: 1px solid var(--c-hairline);
          padding: 0 9px;
        }

        .cl-company-logo {
          flex: 0 0 auto;
        }

        .cl-source-name {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--c-ink-hi);
          font-size: 12px;
          font-weight: 560;
          line-height: 1;
        }

        .cl-timeline-cell {
          min-width: 0;
          padding: 0 9px;
        }

        .cl-track-labels {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
          color: var(--c-ink-dim);
          font-size: 8px;
          line-height: 1;
        }

        .cl-track-labels span:last-child {
          color: color-mix(in srgb, var(--c-event-green) 82%, var(--c-ink-hi));
        }

        .cl-track {
          position: relative;
          height: 15px;
          overflow: hidden;
          border-radius: 999px;
          background:
            linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px),
            rgba(255, 255, 255, 0.026);
          background-size: 33.333% 100%, auto;
        }

        .cl-track-line {
          position: absolute;
          left: 7px;
          right: 7px;
          top: 50%;
          height: 1px;
          transform: translateY(-50%);
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.09),
            color-mix(in srgb, var(--source-color) 58%, transparent),
            rgba(74, 222, 128, 0.42)
          );
        }

        .cl-event-block,
        .cl-flow-block {
          position: absolute;
          top: 50%;
          height: 7px;
          border-radius: 2px;
          background: var(--source-color);
          transform: translateY(-50%);
          box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.42);
        }

        .cl-event-block-hot {
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.16),
            0 0 12px color-mix(in srgb, var(--source-color) 24%, transparent);
        }

        .cl-flow-block {
          left: 0;
          width: 15px;
          opacity: 0;
        }

        .cl-row-meta {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 5px;
          height: 100%;
          border-left: 1px solid var(--c-hairline);
          padding: 0 8px 0 7px;
          color: var(--c-ink-dim);
          font-size: 8px;
          line-height: 1;
          white-space: nowrap;
        }

        .cl-status-dot {
          height: 5px;
          width: 5px;
          flex: 0 0 auto;
        }

        .cl-selected-panel {
          display: grid;
          height: 100%;
          grid-template-rows: auto minmax(0, 1fr) auto;
          gap: 12px;
          padding: 17px 18px 18px;
        }

        .cl-selected-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: var(--c-ink-dim);
          font-size: 9px;
          line-height: 1;
        }

        .cl-source-lockup {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          min-height: 36px;
        }

        .cl-source-chip {
          display: grid;
          height: 36px;
          min-width: 0;
          grid-template-columns: auto minmax(0, 1fr);
          column-gap: 6px;
          align-items: center;
          border: 1px solid var(--c-hairline);
          border-radius: 8px;
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--source-color) 10%, transparent), transparent),
            rgba(255, 255, 255, 0.026);
          padding: 0 9px 0 7px;
        }

        .cl-source-chip span,
        .cl-source-chip small {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          line-height: 1;
        }

        .cl-source-chip span {
          color: var(--c-ink-hi);
          font-size: 9.5px;
        }

        .cl-source-chip small {
          grid-column: 2;
          color: var(--c-ink-dim);
          font-size: 7px;
        }

        .cl-trace-hero {
          position: relative;
          display: grid;
          min-height: 142px;
          grid-template-columns: minmax(0, 1fr) auto;
          grid-template-rows: minmax(0, 1fr) auto;
          align-items: center;
          gap: 14px 16px;
          border: 1px solid rgba(139, 92, 246, 0.28);
          border-radius: 24px;
          background:
            linear-gradient(135deg, rgba(139, 92, 246, 0.14), rgba(45, 212, 191, 0.04) 48%, rgba(74, 222, 128, 0.055)),
            color-mix(in srgb, var(--c-surface-00) 78%, black);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.07),
            0 0 0 1px rgba(255, 255, 255, 0.026);
          padding: 18px;
          transform-origin: center;
        }

        .cl-trace-copy {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 6px;
          line-height: 1;
        }

        .cl-trace-kicker,
        .cl-trace-foot {
          color: var(--c-ink-dim);
          font-size: 9px;
          line-height: 1;
        }

        .cl-trace-copy strong {
          color: var(--c-ink-hi);
          font-size: 20px;
          font-weight: 700;
        }

        .cl-trace-copy > span:not(.cl-trace-kicker) {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--c-ink-dim);
          font-size: 8px;
        }

        .cl-trace-foot {
          grid-column: 1 / -1;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          border-top: 1px solid var(--c-hairline);
          padding-top: 12px;
        }

        .cl-trace-foot span:last-child {
          color: color-mix(in srgb, var(--c-event-green) 82%, var(--c-ink-hi));
          text-align: right;
        }

        .cl-trace-blocks {
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .cl-trace-block {
          display: block;
          border-radius: 4px;
          background: var(--source-color);
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.14),
            0 0 14px color-mix(in srgb, var(--source-color) 18%, transparent);
        }

        .cl-trace-blocks-hero .cl-trace-block {
          height: 10px;
          width: 36px;
        }

        .cl-trace-blocks-compact .cl-trace-block {
          height: 9px;
          width: 28px;
        }

        .cl-replay-panel {
          display: grid;
          height: 100%;
          grid-template-rows: auto minmax(0, 1fr) auto;
          gap: 12px;
          padding: 18px;
        }

        .cl-replay-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: start;
          gap: 12px;
          border-bottom: 1px solid var(--c-hairline);
          padding-bottom: 12px;
        }

        .cl-replay-title,
        .cl-replay-meta {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 7px;
          line-height: 1;
        }

        .cl-replay-title span,
        .cl-replay-meta span {
          color: var(--c-ink-dim);
          font-size: 9px;
        }

        .cl-replay-title strong {
          color: var(--c-ink-hi);
          font-size: 20px;
          font-weight: 700;
        }

        .cl-replay-meta {
          align-items: flex-end;
          white-space: nowrap;
        }

        .cl-replay-steps {
          display: grid;
          align-content: start;
          gap: 8px;
          min-height: 0;
        }

        .cl-replay-row {
          display: grid;
          height: 42px;
          min-width: 0;
          grid-template-columns: 24px 11px minmax(0, 1fr) 46px 50px;
          align-items: center;
          gap: 7px;
          overflow: hidden;
          border: 1px solid var(--c-hairline);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.026);
          padding: 0 10px;
          line-height: 1;
        }

        .cl-replay-index,
        .cl-replay-source,
        .cl-replay-time {
          color: var(--c-ink-dim);
          font-size: 8px;
          white-space: nowrap;
        }

        .cl-replay-marker {
          height: 8px;
          width: 8px;
          border-radius: 3px;
          background: var(--source-color);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--source-color) 12%, transparent);
        }

        .cl-replay-event {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--c-ink-hi);
          font-size: 9px;
        }

        .cl-replay-source,
        .cl-replay-time {
          text-align: right;
        }

        .cl-ready-state {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 9px;
          min-height: 40px;
          border: 1px solid rgba(74, 222, 128, 0.22);
          border-radius: 12px;
          background:
            linear-gradient(180deg, rgba(74, 222, 128, 0.08), rgba(74, 222, 128, 0.028)),
            rgba(255, 255, 255, 0.018);
          padding: 0 11px;
          line-height: 1;
        }

        .cl-ready-dot {
          height: 8px;
          width: 8px;
          box-shadow: 0 0 0 4px rgba(74, 222, 128, 0.1);
        }

        .cl-ready-copy {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 5px;
        }

        .cl-ready-copy strong {
          color: var(--c-event-green);
          font-size: 10px;
          font-weight: 660;
          white-space: nowrap;
        }

        .cl-ready-copy span,
        .cl-ready-env {
          color: var(--c-ink-dim);
          font-size: 8px;
          white-space: nowrap;
        }

        .cl-ready-env {
          text-align: right;
        }

        .cl-static-panel {
          display: grid;
          height: 100%;
          grid-template-rows: auto auto minmax(0, 1fr);
          gap: 10px;
          padding: 15px;
        }

        .cl-static-production,
        .cl-static-trace,
        .cl-static-replay {
          border: 1px solid var(--c-hairline);
          background: rgba(255, 255, 255, 0.024);
        }

        .cl-static-production {
          border-radius: 13px;
          padding: 10px;
        }

        .cl-static-label,
        .cl-static-trace span,
        .cl-static-replay span,
        .cl-static-replay small {
          color: var(--c-ink-dim);
          font-size: 8px;
          line-height: 1;
        }

        .cl-static-streams {
          display: grid;
          gap: 6px;
          margin-top: 8px;
        }

        .cl-static-source-row {
          display: grid;
          height: 28px;
          grid-template-columns: auto 58px minmax(0, 1fr) 66px;
          align-items: center;
          gap: 7px;
          min-width: 0;
          color: var(--c-ink-hi);
          font-size: 9px;
          line-height: 1;
        }

        .cl-static-track {
          position: relative;
          height: 12px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.035);
        }

        .cl-static-track span {
          position: absolute;
          top: 50%;
          height: 6px;
          width: 14px;
          border-radius: 2px;
          background: var(--source-color);
          transform: translateY(-50%);
        }

        .cl-static-track span:nth-child(1) {
          left: 18%;
          opacity: 0.42;
        }

        .cl-static-track span:nth-child(2) {
          left: 48%;
        }

        .cl-static-track span:nth-child(3) {
          left: 78%;
          opacity: 0.42;
        }

        .cl-static-source-row small {
          overflow: hidden;
          color: var(--c-ink-dim);
          font-size: 7px;
          white-space: nowrap;
        }

        .cl-static-trace {
          display: grid;
          min-height: 58px;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 12px;
          border-radius: 999px;
          padding: 0 16px;
        }

        .cl-static-trace > div {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 6px;
        }

        .cl-static-trace strong,
        .cl-static-replay strong {
          color: var(--c-ink-hi);
          font-size: 18px;
          line-height: 1;
        }

        .cl-static-replay {
          display: flex;
          min-height: 0;
          flex-direction: column;
          justify-content: center;
          gap: 8px;
          border-color: rgba(74, 222, 128, 0.22);
          border-radius: 13px;
          padding: 13px 15px;
        }

        .cl-static-replay strong {
          color: var(--c-event-green);
        }

        @media (max-width: 380px) {
          .cl-header {
            left: 15px;
            right: 15px;
            gap: 6px;
          }

          .cl-core-label {
            display: none;
          }

          .cl-production-panel,
          .cl-replay-panel {
            padding: 14px;
          }

          .cl-replay-panel {
            grid-template-rows: auto auto auto;
            gap: 8px;
            padding: 12px;
          }

          .cl-replay-header {
            gap: 8px;
            padding-bottom: 8px;
          }

          .cl-replay-title,
          .cl-replay-meta {
            gap: 5px;
          }

          .cl-replay-steps {
            gap: 6px;
          }

          .cl-axis-row,
          .cl-stream-row {
            grid-template-columns: 96px minmax(0, 1fr) 54px;
          }

          .cl-row-meta {
            padding: 0 6px;
          }

          .cl-row-meta span:last-child {
            max-width: 42px;
            overflow: hidden;
            text-overflow: clip;
          }

          .cl-selected-panel {
            gap: 8px;
            padding: 13px 15px 15px;
          }

          .cl-source-chip small {
            display: none;
          }

          .cl-trace-hero {
            min-height: 50px;
          }

          .cl-trace-copy strong,
          .cl-replay-title strong,
          .cl-static-trace strong,
          .cl-static-replay strong {
            font-size: 16px;
          }

          .cl-trace-blocks-hero .cl-trace-block {
            width: 28px;
          }

          .cl-replay-row {
            grid-template-columns: 20px 9px minmax(0, 1fr) 42px;
            height: 34px;
            gap: 6px;
            border-radius: 8px;
            padding: 0 8px;
          }

          .cl-replay-time {
            display: none;
          }

          .cl-ready-state {
            grid-template-columns: auto minmax(0, 1fr);
            min-height: 34px;
            gap: 7px;
            border-radius: 10px;
            padding: 0 9px;
          }

          .cl-ready-env {
            display: none;
          }

          .cl-static-source-row {
            grid-template-columns: auto 50px minmax(0, 1fr);
          }

          .cl-static-source-row small {
            display: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .cl-shared-surface,
          .cl-surface-content,
          .cl-flow-block,
          .cl-event-block,
          .cl-trace-block,
          .cl-replay-row,
          .cl-ready-state {
            transition: none;
          }
        }
      `}
    </style>
  );
}

import * as React from "react";
import { tv, type VariantProps } from "../utils/tv";
import { StatusDot, type StatusDotVariant } from "../primitives/status-dot";

/**
 * EventRow — one row on the event stream. `time`, a lane-colored dot,
 * a mono `topic` with italicized verb, a body preview, and a right-side
 * `source` label.
 *
 * Two density flavors:
 *
 *   density="compact" (default) — Linear-density `.stream-row`. 100 px
 *                                  time column, smaller dot, ember
 *                                  left-bar on `selected`. Use on the
 *                                  product timeline.
 *
 *   density="brand"             — original wider rhythm with 68 px
 *                                  time + halo dot + sans preview.
 *                                  Reach for this on marketing /
 *                                  landing copy.
 *
 * Selection is expressed through `selected`; only selected rows get
 * the ember accent — the "one hot surface" principle, enforced in API
 * shape rather than leaving it to callers.
 */
export type EventLane = Extract<
  StatusDotVariant,
  "teal" | "amber" | "green" | "orange" | "pink" | "violet" | "red"
>;

export type EventRowDensity = "compact" | "brand";

const eventRow = tv({
  base:
    "relative grid items-start outline-none transition-colors duration-fast ease-out " +
    "data-[focus-visible=true]:outline data-[focus-visible=true]:outline-1 " +
    "data-[focus-visible=true]:-outline-offset-1 data-[focus-visible=true]:outline-ember",
  variants: {
    density: {
      compact:
        "grid-cols-[100px_16px_1fr_auto] gap-s-3 px-s-5 py-[8px] " +
        "border-b border-l-border-faint " +
        "data-[hovered=true]:bg-l-wash-1 hover:bg-l-wash-1",
      brand:
        "grid-cols-[68px_18px_1fr_90px] gap-s-4 px-s-6 py-[10px] " +
        "data-[hovered=true]:bg-row-hover hover:bg-row-hover",
    },
    selected: {
      true: "",
      false: "",
    },
  },
  compoundVariants: [
    {
      density: "compact",
      selected: true,
      class:
        "bg-l-surface-selected " +
        "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px] before:bg-ember before:content-['']",
    },
    {
      density: "brand",
      selected: true,
      class:
        "bg-row-active " +
        "before:absolute before:inset-0 before:border-l-2 before:border-ember before:content-['']",
    },
  ],
  defaultVariants: { density: "compact", selected: false },
});

type EventRowVariantProps = VariantProps<typeof eventRow>;

export interface EventRowProps
  extends React.HTMLAttributes<HTMLDivElement>, EventRowVariantProps {
  time: React.ReactNode;
  lane: EventLane;
  topic: React.ReactNode;
  /** Optional italicized verb in Kalice style — `agent.tool.<em>invoke</em>`. */
  verb?: React.ReactNode;
  preview?: React.ReactNode;
  source?: React.ReactNode;
  selected?: boolean;
  density?: EventRowDensity;
}

export function EventRow({
  time,
  lane,
  topic,
  verb,
  preview,
  source,
  selected = false,
  density = "compact",
  className,
  ...props
}: EventRowProps) {
  const isCompact = density === "compact";
  return (
    <div
      className={eventRow({ density, selected, className })}
      data-selected={selected || undefined}
      {...props}
    >
      <span
        className={
          isCompact
            ? "font-mono text-[11px] text-l-ink-dim tracking-mono"
            : "pt-[2px] font-mono text-mono-sm text-ink-dim tracking-mono"
        }
      >
        {time}
      </span>
      <StatusDot
        variant={lane}
        halo={!isCompact}
        className={
          isCompact
            ? "mt-[5px] h-[8px] w-[8px]"
            : "mt-[3px] border-[2px] border-surface-00 box-content"
        }
      />
      <div className="flex min-w-0 flex-col gap-[2px]">
        <div
          className={
            isCompact
              ? "font-mono text-[12px] text-l-ink truncate"
              : "font-mono text-mono-lg text-ink-hi"
          }
        >
          {topic}
          {verb ? (
            <>
              .
              <em
                className={
                  isCompact
                    ? "not-italic text-l-ink-dim"
                    : "not-italic text-ink-dim"
                }
              >
                {verb}
              </em>
            </>
          ) : null}
        </div>
        {preview ? (
          <div
            className={
              isCompact
                ? "overflow-hidden font-sans text-[12px] leading-[1.4] text-l-ink-lo"
                : "overflow-hidden font-sans text-[12.5px] font-light leading-[1.4] text-ink-lo"
            }
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
            }}
          >
            {preview}
          </div>
        ) : null}
      </div>
      {source ? (
        <span
          className={
            isCompact
              ? "self-center font-mono text-[11px] lowercase tracking-mono text-l-ink-dim"
              : "pt-[2px] text-right font-mono text-mono-sm lowercase tracking-mono text-ink-dim"
          }
        >
          {source}
        </span>
      ) : null}
    </div>
  );
}

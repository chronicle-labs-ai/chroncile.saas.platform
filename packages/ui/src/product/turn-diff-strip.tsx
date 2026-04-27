import * as React from "react";
import { cx } from "../utils/cx";

export type TurnState = "hit" | "miss" | "empty";

export interface TurnDiffStripProps extends React.HTMLAttributes<HTMLDivElement> {
  turns: TurnState[];
  height?: number;
  /** Gap between bars in px. */
  gap?: number;
}

const tone: Record<TurnState, string> = {
  hit: "bg-event-green",
  miss: "bg-event-red",
  empty: "bg-white/[0.06]",
};

/**
 * TurnDiffStrip — the divergence heatmap from the replay suite. Each
 * turn is a thin vertical bar; green = match, red = divergence,
 * faint = no data yet.
 */
export function TurnDiffStrip({
  turns,
  height = 16,
  gap = 3,
  className,
  style,
  ...props
}: TurnDiffStripProps) {
  return (
    <div
      className={cx("flex", className)}
      style={{ gap: `${gap}px`, ...style }}
      {...props}
    >
      {turns.map((t, i) => (
        <span
          key={i}
          className={cx("flex-1", tone[t])}
          style={{ height }}
          aria-label={`turn ${i + 1} ${t}`}
        />
      ))}
    </div>
  );
}

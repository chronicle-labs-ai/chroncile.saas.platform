import * as React from "react";
import { cx } from "../utils/cx";

/**
 * Principle — one of three "how this system decides" callouts from the
 * index page. Ember eyebrow + Kalice display heading + Lausanne body.
 */
export interface PrincipleProps extends React.HTMLAttributes<HTMLDivElement> {
  index: string;
  heading: React.ReactNode;
  body: React.ReactNode;
}

export function Principle({
  index,
  heading,
  body,
  className,
  ...props
}: PrincipleProps) {
  return (
    <div className={cx("", className)} {...props}>
      <div className="mb-s-4 font-mono text-mono-sm uppercase tracking-eyebrow text-ember">
        {index} · PRINCIPLE
      </div>
      <h4 className="m-0 mb-s-3 font-display text-[22px] font-medium tracking-tight text-ink-hi leading-[1.15]">
        {heading}
      </h4>
      <p className="m-0 font-sans text-body-sm font-light leading-[1.5] text-ink-lo">
        {body}
      </p>
    </div>
  );
}

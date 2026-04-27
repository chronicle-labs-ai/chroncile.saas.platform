import * as React from "react";
import { tv } from "../utils/tv";
import { Eyebrow } from "../primitives/eyebrow";

const pageHeader = tv({
  slots: {
    root: "mb-s-8 flex items-baseline justify-between gap-s-6",
    body: "flex-1",
    eyebrow: "mb-s-3 block",
    title:
      "m-0 mb-[6px] font-display text-[36px] font-medium tracking-tight text-ink-hi",
    lede: "m-0 max-w-[70ch] font-sans text-[15px] font-light leading-[1.45] text-ink-lo",
    actions: "shrink-0",
  },
});

export interface PageHeaderProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  lede?: React.ReactNode;
  /** Slot rendered on the right side (e.g. version indicator, CTA). */
  actions?: React.ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  const slots = pageHeader({});
  return (
    <div className={slots.root({ className })} {...props}>
      <div className={slots.body()}>
        {eyebrow ? (
          <Eyebrow className={slots.eyebrow()}>{eyebrow}</Eyebrow>
        ) : null}
        <h1 className={slots.title()}>{title}</h1>
        {lede ? <p className={slots.lede()}>{lede}</p> : null}
      </div>
      {actions ? <div className={slots.actions()}>{actions}</div> : null}
    </div>
  );
}

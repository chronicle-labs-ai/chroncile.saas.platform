"use client";

import * as React from "react";

import { tv } from "../utils/tv";

/**
 * ShowcaseCard — design-system "tile with thumb + label foot" used on
 * showcase / brand-index pages. When `href` is provided, renders as a
 * native anchor.
 *
 * For the standard shadcn-style content card (Card / CardHeader /
 * CardContent / CardFooter), reach for `<Card>` from `primitives/`.
 */
const showcaseCardStyles = tv({
  slots: {
    root:
      "group relative flex min-h-[320px] flex-col overflow-hidden rounded-md " +
      "border border-hairline bg-surface-01 no-underline " +
      "transition-[border-color,transform] duration-base ease-out " +
      "outline-none " +
      "hover:border-hairline-strong hover:-translate-y-[2px] " +
      "focus-visible:outline focus-visible:outline-1 " +
      "focus-visible:outline-ember",
    thumb:
      "relative flex-1 overflow-hidden border-b border-hairline " +
      "bg-surface-02 min-h-[220px]",
    foot: "flex items-baseline justify-between gap-s-3 px-s-5 py-s-4",
    num: "font-mono text-mono-sm tracking-tactical text-ink-dim",
    title: "font-sans text-[15px] text-ink-hi",
    subtitle: "block font-mono text-mono-sm text-ink-dim",
    arrow:
      "self-center font-mono text-[14px] text-ink-dim " +
      "transition-colors duration-base ease-out " +
      "group-hover:text-ember",
  },
});

export interface ShowcaseCardProps extends Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "title"
> {
  /** Visual top slot. */
  thumb?: React.ReactNode;
  /** Two-digit ordinal shown next to the title (e.g. "01"). */
  num?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Show the hero arrow affordance in the foot. Defaults to true for anchors. */
  showArrow?: boolean;
  /** Extra classes on the thumb container — lets callers size it. */
  thumbClassName?: string;
}

export function ShowcaseCard({
  thumb,
  num,
  title,
  subtitle,
  showArrow = true,
  href,
  className,
  thumbClassName,
  children,
  ...props
}: ShowcaseCardProps) {
  const slots = showcaseCardStyles({});
  const inner = (
    <>
      {thumb ? (
        <div className={slots.thumb({ className: thumbClassName })}>
          {thumb}
        </div>
      ) : null}
      {children}
      {title || num ? (
        <div className={slots.foot()}>
          <div className="flex items-baseline gap-s-3">
            {num ? <span className={slots.num()}>{num}</span> : null}
            {title ? (
              <div>
                <span className={slots.title()}>{title}</span>
                {subtitle ? (
                  <span className={slots.subtitle()}>{subtitle}</span>
                ) : null}
              </div>
            ) : null}
          </div>
          {showArrow && href ? (
            <span aria-hidden className={slots.arrow()}>
              →
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <a
        {...props}
        href={href}
        className={slots.root({ className })}
      >
        {inner}
      </a>
    );
  }

  // Drop anchor-only props when rendering as a <div>.
  const {
    target: _t,
    rel: _r,
    download: _d,
    ping: _p,
    referrerPolicy: _rp,
    hrefLang: _hl,
    media: _m,
    type: _ty,
    ...divProps
  } = props;

  return (
    <div
      className={slots.root({ className })}
      {...(divProps as React.HTMLAttributes<HTMLDivElement>)}
    >
      {inner}
    </div>
  );
}

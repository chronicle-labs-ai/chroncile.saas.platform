"use client";

import * as React from "react";
import { Link as RACLink } from "react-aria-components";

import { tv } from "../utils/tv";

/**
 * Card — the design-system card with a visual thumb + label foot. Used
 * on the brand index and as a general "clickable tile with preview"
 * primitive. When `href` is provided, renders via RAC's `Link` so
 * navigation integrates with `RouterProvider` (client-side routing) and
 * press/hover/focus states are unified with the rest of the system.
 */
const cardStyles = tv({
  slots: {
    root:
      "group relative flex min-h-[320px] flex-col overflow-hidden rounded-md " +
      "border border-hairline bg-surface-01 no-underline " +
      "transition-[border-color,transform] duration-base ease-out " +
      "outline-none " +
      "data-[hovered=true]:border-hairline-strong data-[hovered=true]:-translate-y-[2px] " +
      "hover:border-hairline-strong hover:-translate-y-[2px] " +
      "data-[focus-visible=true]:outline data-[focus-visible=true]:outline-1 " +
      "data-[focus-visible=true]:outline-ember",
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
      "group-hover:text-ember group-data-[hovered=true]:text-ember",
  },
});

export interface CardProps extends Omit<
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

export function Card({
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
}: CardProps) {
  const slots = cardStyles({});
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
    // RAC Link uses FocusableElement event types, which aren't compatible
    // with raw HTMLAnchorElement handlers from AnchorHTMLAttributes. Pick
    // only the anchor-specific props that are safe to forward.
    const {
      target,
      rel,
      download,
      hrefLang,
      referrerPolicy,
      id,
      style,
      "aria-label": ariaLabel,
    } = props;
    return (
      <RACLink
        href={href}
        target={target}
        rel={rel}
        download={download as never}
        hrefLang={hrefLang}
        referrerPolicy={referrerPolicy}
        id={id}
        style={style}
        aria-label={ariaLabel}
        className={slots.root({ className })}
      >
        {inner}
      </RACLink>
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

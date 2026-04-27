"use client";

/*
 * ScrollShadow — wraps a scrollable region and shows fade gradients at
 * the leading/trailing edges only when content is clipped in that
 * direction. Pure CSS + a tiny IntersectionObserver, no RAC dependency.
 */

import * as React from "react";
import { tv, type VariantProps } from "../utils/tv";

const scrollShadow = tv({
  slots: {
    root: "relative",
    container: "overflow-auto",
    startShadow:
      "pointer-events-none absolute left-0 top-0 z-10 " +
      "transition-opacity duration-fast ease-out",
    endShadow:
      "pointer-events-none absolute right-0 bottom-0 z-10 " +
      "transition-opacity duration-fast ease-out",
  },
  variants: {
    orientation: {
      vertical: {
        startShadow:
          "left-0 right-0 top-0 h-[24px] " +
          "bg-gradient-to-b from-[var(--c-surface-00)] to-transparent",
        endShadow:
          "left-0 right-0 bottom-0 h-[24px] " +
          "bg-gradient-to-t from-[var(--c-surface-00)] to-transparent",
      },
      horizontal: {
        startShadow:
          "top-0 bottom-0 left-0 w-[24px] " +
          "bg-gradient-to-r from-[var(--c-surface-00)] to-transparent",
        endShadow:
          "top-0 bottom-0 right-0 w-[24px] " +
          "bg-gradient-to-l from-[var(--c-surface-00)] to-transparent",
      },
    },
  },
  defaultVariants: { orientation: "vertical" },
});

type ScrollShadowVariantProps = VariantProps<typeof scrollShadow>;

export interface ScrollShadowProps
  extends React.HTMLAttributes<HTMLDivElement>, ScrollShadowVariantProps {
  orientation?: "vertical" | "horizontal";
  /** Tailwind class for the scroll container (e.g. max-h-[320px]). */
  containerClassName?: string;
}

export function ScrollShadow({
  orientation = "vertical",
  className,
  containerClassName,
  children,
  ...props
}: ScrollShadowProps) {
  const slots = scrollShadow({ orientation });
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [showStart, setShowStart] = React.useState(false);
  const [showEnd, setShowEnd] = React.useState(false);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      if (orientation === "vertical") {
        setShowStart(el.scrollTop > 1);
        setShowEnd(el.scrollHeight - el.clientHeight - el.scrollTop > 1);
      } else {
        setShowStart(el.scrollLeft > 1);
        setShowEnd(el.scrollWidth - el.clientWidth - el.scrollLeft > 1);
      }
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(onScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [orientation]);

  return (
    <div className={slots.root({ className })} {...props}>
      <div
        ref={containerRef}
        className={`${slots.container()}${containerClassName ? ` ${containerClassName}` : ""}`}
      >
        {children}
      </div>
      <div
        aria-hidden
        className={slots.startShadow()}
        style={{ opacity: showStart ? 1 : 0 }}
      />
      <div
        aria-hidden
        className={slots.endShadow()}
        style={{ opacity: showEnd ? 1 : 0 }}
      />
    </div>
  );
}

"use client";

import * as React from "react";
import { cx } from "../utils/cx";

/**
 * TopBar — the 44 px Linear-density product top rail. A compound
 * primitive that hosts breadcrumbs on the left, a flexible spacer,
 * and stateful pills on the right (live indicator, time selector,
 * search trigger).
 *
 *   <TopBar>
 *     <TopBar.Crumb>
 *       Chronicle <TopBar.CrumbSep /> support-agent
 *       <TopBar.CrumbSep /> <TopBar.CrumbActive>Timeline</TopBar.CrumbActive>
 *     </TopBar.Crumb>
 *     <TopBar.Spacer />
 *     <TopBar.Live on />
 *     <TopBar.TimeSelector>Last 1h · 1s resolution</TopBar.TimeSelector>
 *     <TopBar.SearchTrigger />
 *   </TopBar>
 *
 * Renders as a flush flex row; sits inside `AppShell`'s `topbar` slot.
 * For brand-density product chrome reach for `<PageHeader>` instead.
 */

const TopBarRoot = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function TopBarRoot({ className, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cx("flex w-full items-center gap-s-2", className)}
      data-slot="top-bar"
      {...props}
    >
      {children}
    </div>
  );
});

const Crumb = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function Crumb({ className, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cx(
        "flex items-center gap-[6px] text-[13px] text-l-ink-lo",
        className
      )}
      data-slot="top-bar-crumb"
      {...props}
    >
      {children}
    </div>
  );
});

const CrumbSep = ({ className }: { className?: string }) => (
  <span aria-hidden className={cx("text-l-ink-dim mx-[2px]", className)}>
    /
  </span>
);

const CrumbActive = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => <b className={cx("text-l-ink font-medium", className)}>{children}</b>;

const Spacer = () => <div className="flex-1" data-slot="top-bar-spacer" />;

interface LiveProps extends React.HTMLAttributes<HTMLButtonElement> {
  on?: boolean;
  onLabel?: React.ReactNode;
  offLabel?: React.ReactNode;
}

const Live = React.forwardRef<HTMLButtonElement, LiveProps>(function Live(
  { on = false, onLabel = "Live", offLabel = "Paused", className, ...props },
  ref
) {
  return (
    <button
      type="button"
      ref={ref}
      data-slot="top-bar-live"
      data-on={on || undefined}
      className={cx(
        "inline-flex h-[26px] items-center gap-[6px] rounded-md border px-[10px] text-[12px] font-medium",
        "transition-colors duration-fast",
        on
          ? "border-[rgba(74,222,128,0.35)] bg-[rgba(74,222,128,0.08)] text-event-green"
          : "border-hairline-strong bg-l-wash-1 text-l-ink-lo hover:bg-l-wash-5 hover:text-l-ink",
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cx(
          "h-[6px] w-[6px] rounded-pill",
          on
            ? "bg-event-green shadow-[0_0_6px_var(--c-event-green)] animate-chron-pulse"
            : "bg-l-ink-dim"
        )}
      />
      <span>{on ? onLabel : offLabel}</span>
    </button>
  );
});

interface TimeSelectorProps extends React.HTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
}

const ClockIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="8" cy="8" r="5.5" />
    <path d="M8 5v3l2 1.5" />
  </svg>
);

const TimeSelector = React.forwardRef<HTMLButtonElement, TimeSelectorProps>(
  function TimeSelector({ icon, className, children, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        data-slot="top-bar-time"
        className={cx(
          "inline-flex h-[26px] items-center gap-[6px] rounded-md border border-hairline-strong bg-l-wash-1 px-[8px]",
          "font-mono text-[11.5px] tracking-mono text-l-ink-lo",
          "hover:bg-l-wash-3 hover:border-l-border-strong hover:text-l-ink",
          "transition-colors duration-fast",
          className
        )}
        {...props}
      >
        {icon ?? <ClockIcon />}
        {children}
      </button>
    );
  }
);

interface SearchTriggerProps extends React.HTMLAttributes<HTMLButtonElement> {
  /** Shortcut hint shown on the right. Pass `null` to hide. */
  shortcut?: React.ReactNode;
  label?: React.ReactNode;
}

const SearchIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L13 13" />
  </svg>
);

const SearchTrigger = React.forwardRef<HTMLButtonElement, SearchTriggerProps>(
  function SearchTrigger(
    { shortcut, label = "Search", className, children, ...props },
    ref
  ) {
    return (
      <button
        ref={ref}
        type="button"
        data-slot="top-bar-search"
        className={cx(
          "inline-flex h-[28px] items-center gap-[6px] rounded-md border border-hairline-strong bg-l-wash-3 px-[10px]",
          "font-sans text-[12.5px] font-medium text-l-ink",
          "hover:bg-l-wash-5 hover:border-l-border-strong",
          "transition-colors duration-fast",
          className
        )}
        {...props}
      >
        <SearchIcon />
        <span>{children ?? label}</span>
        {shortcut !== null ? (
          <span className="ml-[4px] flex gap-[3px]">
            {shortcut ?? (
              <>
                <span className="inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-xs bg-l-wash-5 px-[3px] font-mono text-[10px] text-l-ink">
                  ⌘
                </span>
                <span className="inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-xs bg-l-wash-5 px-[3px] font-mono text-[10px] text-l-ink">
                  K
                </span>
              </>
            )}
          </span>
        ) : null}
      </button>
    );
  }
);

interface TopBarNamespace extends React.ForwardRefExoticComponent<
  React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>
> {
  Crumb: typeof Crumb;
  CrumbSep: typeof CrumbSep;
  CrumbActive: typeof CrumbActive;
  Spacer: typeof Spacer;
  Live: typeof Live;
  TimeSelector: typeof TimeSelector;
  SearchTrigger: typeof SearchTrigger;
}

const TopBar = TopBarRoot as TopBarNamespace;
TopBar.Crumb = Crumb;
TopBar.CrumbSep = CrumbSep;
TopBar.CrumbActive = CrumbActive;
TopBar.Spacer = Spacer;
TopBar.Live = Live;
TopBar.TimeSelector = TimeSelector;
TopBar.SearchTrigger = SearchTrigger;

export { TopBar };

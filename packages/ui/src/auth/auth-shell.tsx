"use client";

import * as React from "react";
import { tv } from "../utils/tv";
import {
  ChromeStyleProvider,
  useChromeStyleContext,
  type ChromeStyle,
} from "../theme/chrome-style-context";
import { AuthTopbar, type AuthTopbarProps } from "./auth-topbar";

/*
 * AuthShell — the v2 single-column shell from `app-v2.jsx`. Three slots:
 *
 *   topbar  — `<AuthTopbar>` with logo + stepper + optional CTA
 *   main    — the screen body, centered in a max-width column
 *   footer  — sticky action row (`step-foot`); usually a back/continue pair
 *
 * Pass `topbar={false}` to hide the topbar entirely (e.g. embedded in a
 * tab). Pass a custom node to override the default `AuthTopbar`.
 *
 * `chromeStyle` is inherited from the nearest `ChromeStyleProvider`
 * (e.g. the Storybook `data-chrome` toolbar) and falls back to
 * `"brand"` when no parent context is set — auth pages rendered
 * standalone in `apps/frontend` therefore stay editorial. Pass an
 * explicit `chromeStyle` to force a flavor regardless of context;
 * the shell wraps children in `ChromeStyleProvider` so `Button` /
 * `Input` / composites pick up the right density without per-control
 * `density` props.
 *
 * The shell paints the ambient backdrop, sets the page surface, and
 * caps the content column at ~520 px so long lede paragraphs stay
 * readable. Set `maxWidth` to override.
 */

const shell = tv({
  slots: {
    root:
      "relative isolate flex min-h-screen w-full flex-col overflow-hidden " +
      "bg-page text-ink",
    main:
      "relative z-[1] flex flex-1 flex-col items-stretch px-s-6 pb-s-12 pt-s-10 " +
      "md:pt-s-16 lg:pt-s-20",
    inner: "mx-auto flex w-full flex-col",
  },
  variants: {
    align: {
      top: { main: "justify-start" },
      center: { main: "justify-center" },
    },
  },
  defaultVariants: { align: "top" },
});

export interface AuthShellProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  /**
   * `<AuthTopbar />` props (rendered as the default topbar) — or a custom
   * React node that fully replaces the topbar — or `false` to hide it.
   */
  topbar?: AuthTopbarProps | React.ReactNode | false;
  /** Content max-width in px. Default 520. */
  maxWidth?: number;
  /** Vertical alignment for short content. */
  align?: "top" | "center";
  /** Hide the ambient backdrop blob (rare — only inside dense embeds). */
  bare?: boolean;
  /**
   * Drives default control density + auth composite surfaces under this shell.
   * Inherits from the nearest `ChromeStyleProvider` (or the Storybook
   * `data-chrome` toolbar); falls back to `"brand"` when neither is set.
   * Pass explicitly to force a flavor regardless of context.
   */
  chromeStyle?: ChromeStyle;
  children: React.ReactNode;
}

function isTopbarProps(v: unknown): v is AuthTopbarProps {
  return (
    !!v &&
    typeof v === "object" &&
    !React.isValidElement(v) &&
    !Array.isArray(v)
  );
}

/**
 * Two-pane shell that hosts every auth + onboarding screen — left
 * column for the form, right column for the brand glass scene.
 * Renders the topbar, the centered content slot, and the
 * theme-aware background.
 */
export function AuthShell({
  topbar,
  maxWidth = 520,
  align = "top",
  bare = false,
  chromeStyle,
  className,
  children,
  ...rest
}: AuthShellProps) {
  const slots = shell({ align });
  const inheritedChrome = useChromeStyleContext();
  const resolvedChrome: ChromeStyle = chromeStyle ?? inheritedChrome ?? "brand";

  let topbarNode: React.ReactNode = null;
  if (topbar !== false) {
    if (topbar == null) {
      topbarNode = <AuthTopbar />;
    } else if (React.isValidElement(topbar)) {
      topbarNode = topbar;
    } else if (isTopbarProps(topbar)) {
      topbarNode = <AuthTopbar {...topbar} />;
    } else {
      topbarNode = topbar;
    }
  }

  return (
    <ChromeStyleProvider value={resolvedChrome}>
      <div
        className={slots.root({ className })}
        data-slot="auth-shell"
        data-chrome={resolvedChrome}
        {...rest}
      >
        {bare ? null : <div className="cg-auth-ambient" aria-hidden />}
        {topbarNode}
        <main className={slots.main()}>
          <div className={slots.inner()} style={{ maxWidth }}>
            {children}
          </div>
        </main>
      </div>
    </ChromeStyleProvider>
  );
}

"use client";

import * as React from "react";

/*
 * Router context — lets framework-agnostic UI components (sidebar
 * nav, breadcrumbs, dropdown commands) defer link rendering and
 * imperative navigation to whatever router the host app uses.
 *
 * Apps that don't wrap in a `LinkProvider` get a plain `<a>` and a
 * `navigate()` that falls back to `window.location.href`. Apps with
 * a client-side router (Next.js App Router, TanStack Router, React
 * Router, etc.) wire `<Link>` + `router.push` through and clicks
 * become smooth client-side transitions instead of full reloads.
 */

/**
 * Minimum prop shape the link component must accept. Compatible
 * with Next.js's `<Link>`, React Router's `<Link>`, and a plain
 * `<a>` tag. Extra unknown props are forwarded — we don't constrain
 * the host's link component beyond `href`.
 */
export interface LinkComponentProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  /** Next.js prefetch hint. Routers without prefetch ignore this. */
  prefetch?: boolean;
  ref?: React.Ref<HTMLAnchorElement>;
}

export type LinkComponent = React.ComponentType<LinkComponentProps>;

/** Imperative navigation hook for cases where a `<Link>` element
 *  isn't appropriate (dropdown commands, command-palette actions). */
export type NavigateFn = (href: string) => void;

const DefaultLink: LinkComponent = function DefaultLink({
  href,
  ref,
  ...rest
}) {
  // Drop `prefetch` — meaningless for a plain anchor — and forward
  // everything else verbatim.
  const { prefetch, ...anchorProps } = rest;
  void prefetch;
  return <a ref={ref} href={href} {...anchorProps} />;
};

const defaultNavigate: NavigateFn = (href) => {
  if (typeof window !== "undefined") {
    window.location.href = href;
  }
};

interface LinkContextValue {
  Link: LinkComponent;
  navigate: NavigateFn;
}

const DEFAULT_VALUE: LinkContextValue = {
  Link: DefaultLink,
  navigate: defaultNavigate,
};

const LinkContext = React.createContext<LinkContextValue>(DEFAULT_VALUE);

export interface LinkProviderProps {
  /** Link component to use for declarative navigation. Falls back
   *  to a plain `<a>` if omitted. */
  component?: LinkComponent;
  /** Imperative navigation function — wire to `router.push` or the
   *  equivalent. Falls back to `window.location.href`. */
  navigate?: NavigateFn;
  children: React.ReactNode;
}

/**
 * LinkProvider — wires the host app's router into the design
 * system. Place once at the top of the dashboard / app shell.
 *
 *   <LinkProvider component={NextLink} navigate={(href) => router.push(href)}>
 *     {children}
 *   </LinkProvider>
 */
export function LinkProvider({
  component,
  navigate,
  children,
}: LinkProviderProps) {
  const value = React.useMemo<LinkContextValue>(
    () => ({
      Link: component ?? DefaultLink,
      navigate: navigate ?? defaultNavigate,
    }),
    [component, navigate],
  );
  return (
    <LinkContext.Provider value={value}>{children}</LinkContext.Provider>
  );
}

/** Resolves the configured link component (or a plain `<a>`). */
export function useLinkComponent(): LinkComponent {
  return React.useContext(LinkContext).Link;
}

/** Resolves the configured imperative navigation function. */
export function useNavigate(): NavigateFn {
  return React.useContext(LinkContext).navigate;
}

/**
 * Stable wrapper that delegates to the context-provided link
 * component. Use this in JSX (e.g. `<RouterLink href="…">`) instead
 * of pulling `useLinkComponent()` and rendering its return value —
 * React's `react-hooks/static-components` rule only allows stable
 * top-level components in JSX, and this one satisfies that.
 */
export const RouterLink: LinkComponent = function RouterLink(props) {
  const Link = React.useContext(LinkContext).Link;
  return <Link {...props} />;
};

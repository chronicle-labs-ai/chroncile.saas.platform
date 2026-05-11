"use client";

import * as React from "react";

import { cn } from "../utils/cn";

/*
 * TextLink — inline hyperlink-styled element for use inside running
 * copy. Renders an `<a>` when given an `href`, otherwise a `<button>`
 * (so it can carry a click handler without the routing semantics of
 * a real link).
 *
 * Visually matches the underlined inline-link convention used across
 * the auth surface: inherits the surrounding text color, bumps to
 * `text-ink-hi` on hover, with a 2px underline offset.
 *
 * Use `<Button variant="link">` for standalone link-shaped CTAs that
 * stand on their own line. Use `<TextLink>` when the link sits inline
 * inside a sentence ("Already have an account? Sign in.").
 */

const baseClass =
  "inline font-medium text-current underline underline-offset-2 transition-colors duration-fast ease-out hover:text-ink-hi focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember";

export interface TextLinkAnchorProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  ref?: React.Ref<HTMLAnchorElement>;
}

export interface TextLinkButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  href?: undefined;
  ref?: React.Ref<HTMLButtonElement>;
  children: React.ReactNode;
}

export type TextLinkProps = TextLinkAnchorProps | TextLinkButtonProps;

export function TextLink(props: TextLinkProps) {
  if ("href" in props && props.href !== undefined) {
    const { className, ref, ...rest } = props;
    return (
      <a
        ref={ref as React.Ref<HTMLAnchorElement>}
        data-slot="text-link"
        className={cn(baseClass, className)}
        {...rest}
      />
    );
  }

  const { className, ref, type, ...rest } = props;
  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type={type ?? "button"}
      data-slot="text-link"
      className={cn(baseClass, className)}
      {...rest}
    />
  );
}

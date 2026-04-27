import * as React from "react";
import { cx } from "../utils/cx";

/**
 * AmbientBackground — the *very subtle* version of the light-source used
 * inside the design-system index page and marketing pages. Two blurred
 * ember/sage glows at opposing corners.
 */
export interface AmbientBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {}

export function AmbientBackground({
  className,
  ...props
}: AmbientBackgroundProps) {
  return (
    <div aria-hidden className={cx("chron-ambient", className)} {...props} />
  );
}

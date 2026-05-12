import * as React from "react";

import { Alert } from "../primitives/alert";

/*
 * TeamErrorBanner — single-line danger notice for the Team Settings
 * surface. Thin alias around `<Alert variant="danger">` so the team
 * package speaks team words at the call site.
 */
export interface TeamErrorBannerProps {
  children: React.ReactNode;
}

export function TeamErrorBanner({ children }: TeamErrorBannerProps) {
  return <Alert variant="danger">{children}</Alert>;
}

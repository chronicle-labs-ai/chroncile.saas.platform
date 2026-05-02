"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { LinkProvider } from "ui";

/**
 * Wires Next.js's App Router `<Link>` and `router.push` into the
 * design-system `LinkProvider`. Lives here (not in
 * `dashboard/layout.tsx`) because passing `NextLink` directly to a
 * server-component-rendered provider would attempt to serialize a
 * function across the server/client boundary, which Next forbids.
 */
export function DashboardLinkRouterProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <LinkProvider
      component={NextLink}
      navigate={(href) => router.push(href)}
    >
      {children}
    </LinkProvider>
  );
}

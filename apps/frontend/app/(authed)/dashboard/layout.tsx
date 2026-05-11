import { DataProviderProvider } from "@/lib/data";

/*
 * Dashboard-scoped layout.
 *
 * Mounts the data middleware (`<DataProviderProvider>`) so every
 * dashboard route can call hooks under `@/lib/data/<domain>/hooks`
 * without each page wiring its own `<QueryClientProvider>`.
 *
 * Authentication, breadcrumb context, and the sidebar shell live
 * one level up in `(authed)/layout.tsx` — that layout is shared
 * with `/settings/*` and shouldn't carry the dashboard-only
 * data-provider wiring.
 */

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <DataProviderProvider>{children}</DataProviderProvider>;
}

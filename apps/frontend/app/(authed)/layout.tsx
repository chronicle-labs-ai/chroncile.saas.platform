import { redirect } from "next/navigation";
import {
  SidebarInset,
  SidebarProvider,
  SiteBreadcrumbProvider,
  SiteHeader,
  Toaster,
} from "ui";
import {
  authWithReason,
  loginErrorCodeFromAuthReason,
} from "@/server/auth/auth";

import { DashboardLinkRouterProvider } from "./link-router-provider";
import { DashboardSidebar } from "./dashboard-sidebar";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { session, reason } = await authWithReason();

  if (!session?.user) {
    const errorCode = loginErrorCodeFromAuthReason(reason);
    const params = new URLSearchParams({ from: "/dashboard" });
    if (errorCode) params.set("error", errorCode);
    redirect(`/login?${params.toString()}`);
  }

  // Multi-org guard. Three states matter:
  //   1. WorkOS sealed session has an active `organizationId` AND the
  //      backend confirms a matching active membership → render dashboard.
  //   2. The user has no organizations at all (signup without invite) →
  //      send to /onboarding/workspace to create one.
  //   3. The user has organizations but the cookie isn't bound to one
  //      (e.g. just signed in via a code path that didn't pick an org) →
  //      bind to the first one and reload.
  const hasActiveOrg = Boolean(
    session.user.workosOrganizationId && session.user.tenantId,
  );
  const hasAnyMembership = session.user.organizations.length > 0;

  if (!hasActiveOrg && !hasAnyMembership) {
    redirect("/onboarding/workspace");
  }

  if (!hasActiveOrg && hasAnyMembership) {
    // Prefer the user's primary org when binding the cookie. Falls back to
    // the first org in their list if the primary isn't reachable.
    const primary = session.user.organizations.find(
      (o) => o.tenantId === session.user.primaryTenantId,
    );
    const target = primary ?? session.user.organizations[0];
    if (target?.workosOrganizationId) {
      redirect(
        `/api/auth/switch-org?organizationId=${encodeURIComponent(
          target.workosOrganizationId,
        )}&from=/dashboard`,
      );
    }
  }

  const user = session.user;

  return (
    <DashboardLinkRouterProvider>
      <SiteBreadcrumbProvider>
        <div className="[--header-height:3.5rem]">
          <SidebarProvider className="flex flex-col">
            <SiteHeader />
            <div className="flex flex-1">
              <DashboardSidebar
                user={{
                  name: user.name || user.email || "Chronicle user",
                  email: user.email || "",
                  avatar: user.image,
                }}
                workspace={{
                  name: user.tenantName || "Chronicle",
                  plan: user.role || "Workspace",
                }}
                organizations={user.organizations}
                primaryTenantId={user.primaryTenantId}
                activeWorkosOrganizationId={user.workosOrganizationId}
              />
              <SidebarInset>
                <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
              </SidebarInset>
            </div>
          </SidebarProvider>
        </div>
      </SiteBreadcrumbProvider>
      <Toaster />
    </DashboardLinkRouterProvider>
  );
}

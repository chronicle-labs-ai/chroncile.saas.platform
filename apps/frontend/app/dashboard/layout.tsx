import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider, SiteHeader, Toaster } from "ui";
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

  if (!session.user.tenantId) {
    redirect("/onboarding/workspace");
  }

  const user = session.user;

  return (
    <DashboardLinkRouterProvider>
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
            />
            <SidebarInset>
              <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </div>
      <Toaster />
    </DashboardLinkRouterProvider>
  );
}

import { auth } from "@/server/auth/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/features/navigation/components/sidebar";
import { Header } from "@/features/navigation/components/header";
import { SidebarNavigationLoaderProvider } from "@/features/navigation/components/sidebar-navigation-loader";
import { FeatureAccessProvider } from "@/shared/feature-access/feature-access-provider";
import { fetchFeatureAccess } from "@/server/feature-access/fetch-feature-access";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const featureAccess = await fetchFeatureAccess();

  return (
    <FeatureAccessProvider access={featureAccess}>
      <SidebarNavigationLoaderProvider>
        <div className="min-h-screen bg-base">
          <Sidebar />
          <div className="lg:pl-[240px]">
            <Header user={session.user} />
            <main className="p-4 lg:p-6">{children}</main>
          </div>
        </div>
      </SidebarNavigationLoaderProvider>
    </FeatureAccessProvider>
  );
}

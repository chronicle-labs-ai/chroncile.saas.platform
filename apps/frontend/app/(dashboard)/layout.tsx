import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { IntercomMessengerWidget } from "@/components/intercom-messenger-widget";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-base">
      <Sidebar />
      <div className="lg:pl-[240px]">
        <Header user={session.user} />
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
      <IntercomMessengerWidget />
    </div>
  );
}

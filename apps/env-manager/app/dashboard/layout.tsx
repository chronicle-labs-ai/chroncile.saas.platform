import { Sidebar } from "@/frontend/navigation/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-00 lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
      <Sidebar
        className="hidden h-screen lg:sticky lg:top-0 lg:flex"
        variant="static"
      />
      <main className="min-w-0 p-6">{children}</main>
    </div>
  );
}

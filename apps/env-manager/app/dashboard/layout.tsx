import { Sidebar } from "@/features/navigation/components/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Sidebar />
      <div className="lg:pl-[240px]">
        <main className="p-6">{children}</main>
      </div>
    </>
  );
}

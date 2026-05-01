import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/auth";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?from=/dashboard");
  }

  if (!session.user.tenantId) {
    redirect("/onboarding/workspace");
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link className="text-sm font-semibold tracking-wide" href="/dashboard">
            Chronicle
          </Link>
          <nav className="flex items-center gap-4 text-sm text-neutral-400">
            <Link className="hover:text-neutral-100" href="/dashboard/connections">
              Connections
            </Link>
            <Link
              className="hover:text-neutral-100"
              href="/dashboard/settings/team"
            >
              Team
            </Link>
            <a className="hover:text-neutral-100" href="/api/auth/sign-out">
              Sign out
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}

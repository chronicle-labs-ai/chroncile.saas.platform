"use client";

import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import {
  EnvCubeIcon,
  EnvDatabaseIcon,
  EnvMailIcon,
  EnvPlusIcon,
  EnvUsersIcon,
  Logo,
  Sidebar as UISidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarMeta,
  SidebarNav,
  SidebarNavItem,
  SidebarNavSection,
  SidebarStatus,
  SidebarUserCard,
} from "ui";

type SidebarProps = {
  className?: string;
  variant?: "fixed" | "static";
};

const navigation = [
  {
    name: "Environments",
    href: "/dashboard",
    icon: <EnvCubeIcon size={14} />,
  },
  {
    name: "New Environment",
    href: "/dashboard/new",
    icon: <EnvPlusIcon size={14} />,
  },
  {
    name: "DB Templates",
    href: "/dashboard/templates",
    icon: <EnvDatabaseIcon size={14} />,
  },
  {
    name: "Developers",
    href: "/dashboard/developers",
    icon: <EnvUsersIcon size={14} />,
  },
  {
    name: "Email Templates",
    href: "/dashboard/email-templates",
    icon: <EnvMailIcon size={14} />,
  },
] as const;

export function Sidebar({ className, variant = "fixed" }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  if (pathname === "/login") return null;

  const envTone = process.env.NODE_ENV === "production" ? "nominal" : "caution";

  return (
    <UISidebar
      className={className}
      variant={variant}
      width="md"
    >
      <SidebarHeader>
        <a href="/dashboard" className="flex min-w-0 items-center gap-s-3">
          <Logo className="h-6 w-6 shrink-0" variant="dark" />
          <span className="truncate font-sans text-sm font-semibold tracking-tight text-ink-hi">
            Chronicle Labs
          </span>
        </a>
      </SidebarHeader>

      <SidebarStatus tone="data" label="Env Manager" trailing="v0.1.0" />

      <SidebarNav aria-label="Env Manager navigation">
        <SidebarNavSection title="Navigation">
          {navigation.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <SidebarNavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                isActive={isActive}
              >
                {item.name}
              </SidebarNavItem>
            );
          })}
        </SidebarNavSection>
      </SidebarNav>

      <SidebarMeta
        rows={[
          { label: "Version", value: "0.1.0" },
          {
            label: "Environment",
            value: process.env.NODE_ENV === "production" ? "PROD" : "DEV",
            tone: envTone,
          },
          { label: "Status", value: "ONLINE", tone: "nominal" },
        ]}
      />

      {session?.user ? (
        <SidebarFooter>
          <SidebarUserCard
            name={session.user.name ?? session.user.email ?? "Operator"}
            email={session.user.email ?? undefined}
            avatarUrl={session.user.image ?? undefined}
            onSignOut={() => void signOut({ callbackUrl: "/login" })}
          />
        </SidebarFooter>
      ) : null}
    </UISidebar>
  );
}

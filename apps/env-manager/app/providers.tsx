"use client";

import { useRouter } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { UIProviders } from "ui";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <UIProviders navigate={(href) => router.push(href)}>
      <SessionProvider>{children}</SessionProvider>
    </UIProviders>
  );
}

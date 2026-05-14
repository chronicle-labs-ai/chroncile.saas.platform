"use client";

import { useRouter } from "next/navigation";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import { UIProviders } from "ui";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <UIProviders navigate={(href) => router.push(href)}>
      <AuthKitProvider>{children}</AuthKitProvider>
    </UIProviders>
  );
}

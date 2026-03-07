import { auth } from "@/server/auth/auth";
import { redirect } from "next/navigation";
import { SandboxListClient } from "@/features/sandbox/client/sandbox-list-client";

export default async function SandboxPage() {
  const session = await auth();

  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  return <SandboxListClient />;
}

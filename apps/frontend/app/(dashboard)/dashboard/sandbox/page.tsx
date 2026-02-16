import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SandboxListClient } from "./sandbox-list-client";

export default async function SandboxPage() {
  const session = await auth();

  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  return <SandboxListClient tenantId={session.user.tenantId} />;
}

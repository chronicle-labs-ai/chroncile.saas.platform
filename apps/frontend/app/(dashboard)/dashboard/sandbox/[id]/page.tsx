import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SandboxEditorClient } from "./sandbox-editor-client";

export default async function SandboxEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const { id } = await params;

  return <SandboxEditorClient sandboxId={id} tenantId={session.user.tenantId} />;
}

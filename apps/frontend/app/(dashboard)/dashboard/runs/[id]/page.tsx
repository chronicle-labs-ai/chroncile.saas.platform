import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { RunDetailClient } from "./run-detail-client";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const { id } = await params;
  return <RunDetailClient runId={id} />;
}

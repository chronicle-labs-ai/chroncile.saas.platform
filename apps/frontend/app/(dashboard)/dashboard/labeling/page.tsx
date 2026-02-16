import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LabelingClient } from "./labeling-client";

export default async function LabelingPage() {
  const session = await auth();

  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  return <LabelingClient tenantId={session.user.tenantId} />;
}

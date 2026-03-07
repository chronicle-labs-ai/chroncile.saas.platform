import { auth } from "@/server/auth/auth";
import { redirect } from "next/navigation";
import { LabelingClient } from "@/features/labeling/client/labeling-client";

export default async function LabelingPage() {
  const session = await auth();

  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  return <LabelingClient />;
}

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { RunsClient } from "./runs-client";

export default async function RunsPage() {
  const session = await auth();

  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  return <RunsClient />;
}

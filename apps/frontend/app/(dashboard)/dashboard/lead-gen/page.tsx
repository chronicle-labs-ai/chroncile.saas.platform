import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LeadGenClient } from "./lead-gen-client";

export default async function LeadGenPage() {
  const session = await auth();

  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  return <LeadGenClient />;
}

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { EventsClient } from "./events-client";

export default async function EventsPage() {
  const session = await auth();

  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const connections = await prisma.connection.findMany({
    where: { tenantId: session.user.tenantId },
    select: { provider: true, status: true },
  });
  const hasActiveIntercom = connections.some(
    (c) => c.provider === "intercom" && c.status === "active"
  );

  return (
    <EventsClient
      tenantId={session.user.tenantId}
      eventsManagerUrl={process.env.EVENTS_MANAGER_URL || "http://localhost:8080"}
      hasActiveIntercom={hasActiveIntercom}
    />
  );
}

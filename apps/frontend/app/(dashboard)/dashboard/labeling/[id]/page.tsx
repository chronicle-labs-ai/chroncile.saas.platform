import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ReviewClient } from "./review-client";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const { id } = await params;

  return (
    <ReviewClient
      traceId={id}
      tenantId={session.user.tenantId}
    />
  );
}

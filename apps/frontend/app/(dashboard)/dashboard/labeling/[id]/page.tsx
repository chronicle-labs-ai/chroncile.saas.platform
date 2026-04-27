import { auth } from "@/server/auth/auth";
import { redirect } from "next/navigation";
import { ReviewClient } from "@/features/labeling/client/review-client";

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

  return <ReviewClient traceId={id} tenantId={session.user.tenantId} />;
}

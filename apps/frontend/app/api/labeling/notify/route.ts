import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { simulateNotification } from "@/lib/labeling/org";

export const dynamic = "force-dynamic";

/** POST /api/labeling/notify — send a review request via Slack or email */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { memberId, traceId, channel, message } = body as {
      memberId: string;
      traceId: string;
      channel: "slack" | "email";
      message?: string;
    };

    if (!memberId || !traceId || !channel) {
      return NextResponse.json(
        { error: "memberId, traceId, and channel are required" },
        { status: 400 }
      );
    }

    // For now, simulate the notification
    const result = simulateNotification({ memberId, traceId, channel, message });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to send notification:", err);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}

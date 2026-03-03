import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ORG_MEMBERS } from "@/lib/labeling/org";
import { getLabelingStore } from "@/lib/labeling/store";
import {
  buildTraceSummaryForNotification,
  formatConfidenceLabel,
  formatDuration,
} from "@/lib/labeling/notification-summary";
import { createActionToken } from "@/lib/email-actions";
import { fetchFromBackend } from "@/lib/backend";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/** POST /api/labeling/notify — build template variables, proxy to backend for send + log. */
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

    if (channel === "email") {
      const member = ORG_MEMBERS.find((m) => m.id === memberId);
      if (!member?.email) {
        return NextResponse.json(
          { error: "Reviewer has no email address" },
          { status: 400 }
        );
      }

      const store = await getLabelingStore();
      const trace = await store.getById(session.user.tenantId, traceId);
      if (!trace) {
        return NextResponse.json(
          { error: "Trace not found" },
          { status: 404 }
        );
      }

      const summary = buildTraceSummaryForNotification(trace, message ?? undefined);

      const viewToken = createActionToken({ action: "view", traceId, escalationId: "esc_frontend", toUserId: memberId });
      const claimToken = createActionToken({ action: "claim", traceId, escalationId: "esc_frontend", toUserId: memberId });
      const escalateToken = createActionToken({ action: "escalate", traceId, escalationId: "esc_frontend", toUserId: memberId });

      const incorrectCount = summary.incorrectActionsCount;
      const incorrectText = incorrectCount > 0
        ? `${incorrectCount}. Critical errors may be present.`
        : `${incorrectCount}.`;

      const variables: Record<string, string> = {
        TRACE_ID: summary.id,
        CONVERSATION_ID: summary.conversationId,
        SOURCES: summary.sources.join(", ") || "—",
        CONFIDENCE: formatConfidenceLabel(summary.confidence),
        EVENT_COUNT: String(summary.eventCount),
        DURATION: formatDuration(summary.firstEventAt, summary.lastEventAt),
        INCORRECT_ACTIONS: incorrectText,
        CUSTOM_MESSAGE: message ?? "",
        VIEW_URL: `${BASE_URL}/api/email-actions/${viewToken}`,
        CLAIM_URL: `${BASE_URL}/api/email-actions/${claimToken}`,
        ESCALATE_URL: `${BASE_URL}/api/email-actions/${escalateToken}`,
      };

      const result = await fetchFromBackend<{
        success: boolean;
        escalationId: string;
        channel: string;
        alreadySent?: boolean;
      }>("/api/platform/labeling/notify", {
        method: "POST",
        body: JSON.stringify({
          memberId,
          traceId,
          channel: "email",
          message: message ?? undefined,
          toEmail: member.email,
          subject: `Trace requires review — #${summary.id}`,
          variables,
        }),
      });

      return NextResponse.json({
        success: result.success,
        escalationId: result.escalationId,
        channel: "email",
        ...(result.alreadySent !== undefined && { alreadySent: result.alreadySent }),
      });
    }

    const result = await fetchFromBackend<{
      success: boolean;
      escalationId: string;
      channel: string;
      alreadySent?: boolean;
    }>("/api/platform/labeling/notify", {
      method: "POST",
      body: JSON.stringify({
        memberId,
        traceId,
        channel: "slack",
        message: message ?? undefined,
      }),
    });

    return NextResponse.json({
      success: result.success,
      escalationId: result.escalationId,
      channel: "slack",
      memberName: ORG_MEMBERS.find((m) => m.id === memberId)?.name ?? "Unknown",
      sentAt: new Date().toISOString(),
      ...(result.alreadySent !== undefined && { alreadySent: result.alreadySent }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send notification";
    console.error("Notify failed:", err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

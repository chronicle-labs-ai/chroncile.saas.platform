import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/db";
import eventsManager from "@/lib/events-manager";

export const dynamic = "force-dynamic";

interface IntercomWebhook {
  type: string;
  app_id?: string;
  topic: string;
  id?: string;
  created_at?: number;
  data: {
    type?: string;
    item: Record<string, unknown>;
  };
}

function verifySignature(secret: string, body: Buffer, signature?: string): boolean {
  if (!signature) return false;
  
  const expectedSignature = "sha1=" + crypto
    .createHmac("sha1", secret)
    .update(body)
    .digest("hex");
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

function extractConversationId(webhook: IntercomWebhook): string {
  const item = webhook.data.item;
  
  if (item.id) return item.id as string;
  if (item.conversation_id) return item.conversation_id as string;
  
  return `unknown_${Date.now()}`;
}

function extractActorInfo(webhook: IntercomWebhook): { type: "customer" | "agent" | "system"; id: string; name?: string } {
  const item = webhook.data.item;
  const topic = webhook.topic;
  
  if (topic.includes(".user.")) {
    const contacts = item.contacts as { contacts?: Array<{ id: string; name?: string }> } | undefined;
    const contact = contacts?.contacts?.[0];
    if (contact) {
      return { type: "customer", id: contact.id, name: contact.name };
    }
    
    const source = item.source as { author?: { id?: string; name?: string; type?: string } } | undefined;
    if (source?.author) {
      return { 
        type: source.author.type === "user" ? "customer" : "agent",
        id: source.author.id || "unknown",
        name: source.author.name
      };
    }
  }
  
  if (topic.includes(".admin.")) {
    const assignee = item.assignee as { id?: string; name?: string } | undefined;
    if (assignee) {
      return { type: "agent", id: assignee.id || "unknown", name: assignee.name };
    }
  }
  
  return { type: "system", id: "intercom" };
}

function mapTopicToEventType(topic: string): string {
  const mapping: Record<string, string> = {
    "conversation.user.created": "conversation.started",
    "conversation.user.replied": "message.received",
    "conversation.admin.replied": "message.sent",
    "conversation.admin.closed": "conversation.closed",
    "conversation.admin.opened": "conversation.reopened",
    "conversation.admin.assigned": "conversation.assigned",
    "conversation.admin.noted": "note.added",
    "user.created": "user.created",
    "user.tag.created": "user.tagged",
    "ticket.created": "ticket.created",
    "ticket.state.updated": "ticket.updated",
    "ping": "system.ping",
  };
  
  return mapping[topic] || `intercom.${topic}`;
}

export async function HEAD() {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "HEAD, POST, OPTIONS",
    }
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Hub-Signature",
    }
  });
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.INTERCOM_WEBHOOK_SECRET;
  
  let body: Buffer;
  try {
    body = Buffer.from(await request.arrayBuffer());
  } catch (err) {
    console.error("Failed to read request body:", err);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (webhookSecret) {
    const signature = request.headers.get("X-Hub-Signature");
    if (!verifySignature(webhookSecret, body, signature || undefined)) {
      console.error("Webhook signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let webhook: IntercomWebhook;
  try {
    webhook = JSON.parse(body.toString());
  } catch (err) {
    console.error("Failed to parse webhook payload:", err);
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  console.log(`Received Intercom webhook: topic=${webhook.topic}, app_id=${webhook.app_id}`);

  if (webhook.topic === "ping") {
    return NextResponse.json({ 
      received: true, 
      message: "Ping received" 
    });
  }

  if (!webhook.app_id) {
    console.error("Webhook missing app_id");
    return NextResponse.json({ error: "Missing app_id" }, { status: 400 });
  }

  let connection = await prisma.connection.findFirst({
    where: {
      provider: "intercom",
      status: "active",
      metadata: {
        path: ["workspace_id"],
        equals: webhook.app_id,
      },
    },
    include: {
      tenant: true,
    },
  });

  if (!connection) {
    connection = await prisma.connection.findFirst({
      where: {
        provider: "intercom",
        status: "active",
      },
      include: {
        tenant: true,
      },
    });

    if (connection) {
      const currentMetadata = (connection.metadata as Record<string, unknown>) || {};
      await prisma.connection.update({
        where: { id: connection.id },
        data: {
          metadata: {
            ...currentMetadata,
            workspace_id: webhook.app_id,
          },
        },
      });
      console.log(`Learned workspace_id=${webhook.app_id} for connection ${connection.id}, tenant=${connection.tenantId}`);
    }
  }

  if (!connection) {
    console.error(`No active Intercom connection found for app_id: ${webhook.app_id}`);
    return NextResponse.json({ 
      received: true,
      message: "No active Intercom connection found - webhook ignored" 
    });
  }

  const tenantId = connection.tenantId;
  console.log(`Matched webhook to tenant: ${tenantId} (${connection.tenant.name})`);

  const webhookId = webhook.id || `generated_${Date.now()}`;
  const sourceEventId = `intercom_${webhookId}`;
  const conversationId = extractConversationId(webhook);
  const actor = extractActorInfo(webhook);
  const eventType = mapTopicToEventType(webhook.topic);

  try {
    const result = await eventsManager.ingestEvent({
      source: "intercom",
      source_event_id: sourceEventId,
      event_type: eventType,
      conversation_id: conversationId,
      actor_type: actor.type,
      actor_id: actor.id,
      actor_name: actor.name,
      payload: {
        topic: webhook.topic,
        app_id: webhook.app_id,
        item: webhook.data.item,
        created_at: webhook.created_at,
      },
      contains_pii: true,
      occurred_at: webhook.created_at 
        ? new Date(webhook.created_at * 1000).toISOString() 
        : undefined,
      tenant_id: tenantId,
    });

    console.log(`Event ingested: ${result.event_id}, type=${eventType}`);

    return NextResponse.json({
      received: true,
      event_id: result.event_id,
      tenant_id: tenantId,
      message: `Webhook processed: ${webhook.topic}`,
    });
  } catch (err) {
    console.error("Failed to ingest event to Events Manager:", err);
    
    return NextResponse.json({
      received: true,
      message: "Webhook received but failed to forward to Events Manager",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import type { ConnectWebhookPayload } from "@/lib/pipedream";

export const dynamic = "force-dynamic";

/**
 * POST /api/pipedream/auth-webhook
 * 
 * Receives webhook notifications from Pipedream when a user
 * completes (or fails) the account connection flow.
 * 
 * Events:
 * - CONNECTION_SUCCESS: Account connected successfully
 * - CONNECTION_ERROR: Error during connection
 */
export async function POST(request: NextRequest) {
  let payload: ConnectWebhookPayload;
  
  try {
    payload = await request.json();
  } catch {
    console.error("Failed to parse Pipedream auth webhook payload");
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  console.log(`Received Pipedream auth webhook: event=${payload.event}`);

  if (payload.event === "CONNECTION_ERROR") {
    console.error("Pipedream connection error:", payload.error);
    // We don't need to do anything here - the frontend will show the error
    return NextResponse.json({ received: true, event: "CONNECTION_ERROR" });
  }

  if (payload.event === "CONNECTION_SUCCESS") {
    const { account } = payload;
    
    // The external_user_id is our tenantId
    // We need to extract it from the connect session
    // For now, we'll look up by the account's external_id or use the environment
    
    // In Pipedream Connect, the external_user_id is passed when creating the token
    // and should be available in the account. However, the webhook doesn't directly
    // include it, so we need to find the tenant by querying existing connections
    // or use a different strategy.
    
    // Strategy: Store a mapping in a temporary cache or look up by the account details
    // For now, we'll try to find an existing connection for this provider
    // or create a new one if we can identify the tenant.
    
    // Since we use tenantId as external_user_id, we can try to find the tenant
    // by looking for any connection that might have this account linked
    
    // The safest approach is to use the connect_token to look up the session
    // but since we don't have that mapping stored, we'll log the event
    // and let the frontend handle the connection creation via the triggers API
    
    console.log(`Pipedream account connected: id=${account.id}, app=${account.app.name_slug}`);
    console.log(`Account details: name=${account.name}, healthy=${account.healthy}`);

    // Try to find or create the connection
    // The external_id in the account might help us identify the tenant
    // but the most reliable way is to look up pending connection requests
    
    // For now, we'll acknowledge the webhook and rely on the frontend
    // to call the accounts API to get the full account details
    
    return NextResponse.json({
      received: true,
      event: "CONNECTION_SUCCESS",
      accountId: account.id,
      app: account.app.name_slug,
    });
  }

  return NextResponse.json({ received: true });
}

/**
 * Handle Pipedream connection success by creating/updating a Connection record
 * 
 * This is called from the frontend after successful OAuth
 */
export async function PUT(request: NextRequest) {
  let body: { tenantId: string; accountId: string; app: string; accountName?: string };
  
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { tenantId, accountId, app, accountName } = body;

  if (!tenantId || !accountId || !app) {
    return NextResponse.json(
      { error: "Missing required fields: tenantId, accountId, app" },
      { status: 400 }
    );
  }

  try {
    // Create or update the connection record
    const connection = await prisma.connection.upsert({
      where: {
        tenantId_provider: {
          tenantId,
          provider: app,
        },
      },
      create: {
        tenantId,
        provider: app,
        pipedreamAuthId: accountId,
        metadata: {
          account_name: accountName,
          connected_via: "pipedream",
          connected_at: new Date().toISOString(),
        },
        status: "active",
      },
      update: {
        pipedreamAuthId: accountId,
        metadata: {
          account_name: accountName,
          connected_via: "pipedream",
          connected_at: new Date().toISOString(),
        },
        status: "active",
        updatedAt: new Date(),
      },
    });

    console.log(`Connection saved: id=${connection.id}, provider=${app}, pipedreamAuthId=${accountId}`);

    return NextResponse.json({
      success: true,
      connectionId: connection.id,
    });
  } catch (error) {
    console.error("Failed to save Pipedream connection:", error);
    return NextResponse.json(
      { error: "Failed to save connection" },
      { status: 500 }
    );
  }
}

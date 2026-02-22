import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { encrypt } from "@/lib/encryption";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET: return agent endpoint config for tenant (no secrets). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const config = await prisma.agentEndpointConfig.findUnique({
    where: { tenantId },
  });

  if (!config) {
    return NextResponse.json({
      endpointUrl: null,
      authType: "none",
      authHeaderName: null,
      customHeaders: [],
      configured: false,
    });
  }

  let customHeaders: Array<{ name: string; value?: string; masked?: boolean }> = [];
  if (config.customHeadersJson && Array.isArray(config.customHeadersJson)) {
    customHeaders = (
      config.customHeadersJson as Array<{ name?: string; value?: string }>
    ).map((h) => ({
      name: h?.name ?? "",
      value: typeof h?.value === "string" && h.value.length > 0 ? "••••••••" : undefined,
      masked: typeof h?.value === "string" && h.value.length > 0,
    }));
  }

  return NextResponse.json({
    endpointUrl: config.endpointUrl,
    authType: config.authType,
    authHeaderName: config.authHeaderName,
    basicUsername: config.basicUsername,
    customHeaders,
    configured: Boolean(config.endpointUrl),
  });
}

/** PUT: create or update agent endpoint config. */
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  let body: {
    endpointUrl?: string | null;
    authType?: string;
    authHeaderName?: string | null;
    apiKey?: string;
    bearerToken?: string;
    basicUsername?: string | null;
    basicPassword?: string;
    customHeaders?: Array<{ name: string; value: string }>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    endpointUrl,
    authType = "none",
    authHeaderName,
    apiKey,
    bearerToken,
    basicUsername,
    basicPassword,
    customHeaders,
  } = body;

  if (endpointUrl !== undefined && endpointUrl !== null && endpointUrl !== "") {
    try {
      new URL(endpointUrl);
    } catch {
      return NextResponse.json({ error: "Invalid endpoint URL" }, { status: 400 });
    }
  }

  const validAuthTypes = ["none", "api_key", "bearer", "basic"];
  if (!validAuthTypes.includes(authType)) {
    return NextResponse.json({ error: "Invalid authType" }, { status: 400 });
  }

  let authSecretEncrypted: string | null = null;
  if (authType === "api_key" && apiKey && apiKey.trim() !== "") {
    authSecretEncrypted = encrypt(apiKey.trim());
  } else if (authType === "bearer" && bearerToken && bearerToken.trim() !== "") {
    authSecretEncrypted = encrypt(bearerToken.trim());
  } else if (authType === "basic" && basicPassword && basicPassword.trim() !== "") {
    authSecretEncrypted = encrypt(basicPassword.trim());
  }

  const customHeadersJson =
    Array.isArray(customHeaders) && customHeaders.length > 0
      ? customHeaders
          .filter((h) => typeof h?.name === "string" && h.name.trim() !== "")
          .map((h) => ({ name: h.name.trim(), value: typeof h?.value === "string" ? h.value : "" }))
      : null;

  const customHeadersForPrisma: Prisma.InputJsonValue | typeof Prisma.JsonNull =
    customHeadersJson === null ? Prisma.JsonNull : (customHeadersJson as Prisma.InputJsonValue);

  const data = {
    endpointUrl: endpointUrl === "" || endpointUrl === null ? null : endpointUrl ?? undefined,
    authType,
    authHeaderName: authType === "api_key" ? (authHeaderName ?? "X-API-Key") : null,
    authSecretEncrypted,
    basicUsername: authType === "basic" ? (basicUsername ?? null) : null,
    customHeadersJson: customHeadersForPrisma,
  };

  // If auth is "none" or we're not sending a new secret, preserve existing secret when not provided
  const existing = await prisma.agentEndpointConfig.findUnique({
    where: { tenantId },
  });

  const updateData: Parameters<typeof prisma.agentEndpointConfig.upsert>[0]["update"] = {
    ...data,
    updatedAt: new Date(),
  };

  if (data.authSecretEncrypted === null && existing?.authSecretEncrypted && authType !== "none") {
    // Client didn't send a new secret; keep existing
    updateData.authSecretEncrypted = existing.authSecretEncrypted;
  }

  await prisma.agentEndpointConfig.upsert({
    where: { tenantId },
    create: {
      tenantId,
      endpointUrl: data.endpointUrl ?? null,
      authType: data.authType,
      authHeaderName: data.authHeaderName ?? null,
      authSecretEncrypted: (updateData.authSecretEncrypted as string | null) ?? null,
      basicUsername: data.basicUsername ?? null,
      customHeadersJson: data.customHeadersJson,
    },
    update: updateData,
  });

  const updated = await prisma.agentEndpointConfig.findUnique({
    where: { tenantId },
  });

  let responseCustomHeaders: Array<{ name: string; value?: string; masked?: boolean }> = [];
  if (updated?.customHeadersJson && Array.isArray(updated.customHeadersJson)) {
    responseCustomHeaders = (
      updated.customHeadersJson as Array<{ name?: string; value?: string }>
    ).map((h) => ({
      name: h?.name ?? "",
      value: typeof h?.value === "string" && h.value.length > 0 ? "••••••••" : undefined,
      masked: typeof h?.value === "string" && h.value.length > 0,
    }));
  }

  return NextResponse.json({
    endpointUrl: updated?.endpointUrl ?? null,
    authType: updated?.authType ?? "none",
    authHeaderName: updated?.authHeaderName ?? null,
    basicUsername: updated?.basicUsername ?? null,
    customHeaders: responseCustomHeaders,
    configured: Boolean(updated?.endpointUrl),
  });
}

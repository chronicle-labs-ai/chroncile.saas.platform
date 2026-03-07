import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "platform-api";
import { auth } from "@/server/auth/auth";

const BACKEND_URL = getBackendUrl();
const SERVICE_SECRET = process.env.SERVICE_SECRET || "";

export async function proxyToBackend(
  req: NextRequest,
  backendPath: string,
  options?: { method?: string },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getServiceToken(session.user);

  const method = options?.method || req.method;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const fetchOptions: RequestInit = { method, headers };

  if (method !== "GET" && method !== "HEAD") {
    try {
      const body = await req.text();
      if (body) fetchOptions.body = body;
    } catch {
      // No body.
    }
  }

  const url = new URL(backendPath, BACKEND_URL);
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const backendRes = await fetch(url.toString(), fetchOptions);

  const responseBody = await backendRes.text();
  return new NextResponse(responseBody || null, {
    status: backendRes.status,
    headers: { "Content-Type": "application/json" },
  });
}

interface SessionUser {
  id: string;
  email?: string | null;
  name?: string | null;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getServiceToken(user: SessionUser): Promise<string> {
  const cached = tokenCache.get(user.id);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const res = await fetch(`${BACKEND_URL}/api/platform/auth/token-exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_secret: SERVICE_SECRET,
      user_id: user.id,
      email: user.email,
      name: user.name,
      tenant_id: user.tenantId,
      tenant_name: user.tenantName,
      tenant_slug: user.tenantSlug,
    }),
  });

  if (!res.ok) {
    throw new Error("Token exchange failed");
  }

  const data = await res.json();
  tokenCache.set(user.id, {
    token: data.token,
    expiresAt: Date.now() + 23 * 60 * 60 * 1000,
  });
  return data.token;
}

import { NextResponse } from "next/server";
import { prisma } from "@/backend/data/db";
import { backendFetch } from "@/backend/integrations/backend-client";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ envId: string }> }
) {
  const { envId } = await params;
  const env = await prisma.environment.findUnique({ where: { id: envId } });
  if (!env?.flyAppUrl) {
    return NextResponse.json(
      { error: "Environment not found or has no backend" },
      { status: 404 }
    );
  }

  try {
    const res = await backendFetch(
      env.flyAppUrl,
      "/api/platform/admin/tenants",
      undefined,
      env.serviceSecret
    );
    if (!res.ok) {
      if (res.status === 404) {
        // Admin endpoints were added in a recent backend deploy.
        // Old backend images don't have them yet — not an error, just not available.
        return NextResponse.json({
          tenants: [],
          total: 0,
          pendingDeploy: true,
          error:
            "Tenant management requires the latest backend version. Redeploy the backend to enable this feature.",
        });
      }
      const body = await res.json().catch(() => ({}));
      const msg = body?.error ?? `Backend returned ${res.status}`;
      return NextResponse.json({ tenants: [], total: 0, error: msg });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Strip the "Error: " prefix for cleaner display
    const clean = message.replace(/^Error:\s+/, "");
    return NextResponse.json({ tenants: [], total: 0, error: clean });
  }
}

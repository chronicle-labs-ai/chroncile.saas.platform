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
      "/api/platform/admin/feature-flags",
      undefined,
      env.serviceSecret
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { flags: [], error: data?.error ?? `Backend returned ${res.status}` },
        { status: res.status }
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        flags: [],
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

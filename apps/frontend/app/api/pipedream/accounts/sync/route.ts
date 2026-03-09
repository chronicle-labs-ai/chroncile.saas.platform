import { NextRequest } from "next/server";
import { proxyToBackend } from "@/server/backend/proxy-to-backend";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return proxyToBackend(request, "/api/platform/pipedream/accounts/sync", {
    method: "POST",
  });
}
